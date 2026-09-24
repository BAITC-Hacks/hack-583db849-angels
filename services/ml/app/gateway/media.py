"""Gateway path for transcription and speech media operations."""

from __future__ import annotations

import asyncio
import base64
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
import json
import os
from pathlib import Path
import tempfile
from time import monotonic
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..config import GatewayMode, Settings
from .budget import GatewayBudget, BudgetReservation
from .canonical import cassette_key
from .config import ModelsConfiguration, Provider, TaskName
from .errors import (
    GatewayCassetteMissingError,
    GatewayConfigurationError,
    GatewayProviderError,
    GatewayReplayError,
)
from .usage import FileUsageStore


MediaOperation = Literal["transcribe", "speech"]
DEFAULT_CASSETTES_ROOT = Path(__file__).resolve().parents[4] / "fixtures" / "cassettes"


@dataclass(frozen=True)
class MediaRequest:
    task: TaskName
    operation: MediaOperation
    content: bytes
    content_type: str
    parameters: Mapping[str, str | int | float | bool]
    estimated_units: Decimal

    @property
    def prompt(self) -> str:
        return ""

    @property
    def payload(self) -> Mapping[str, object]:
        return {
            "operation": self.operation,
            "contentType": self.content_type,
            "contentSha256": sha256(self.content).hexdigest(),
            "parameters": dict(self.parameters),
            "estimatedUnits": str(self.estimated_units),
        }


@dataclass(frozen=True)
class MediaProviderRequest:
    task: TaskName
    operation: MediaOperation
    model: str
    content: bytes
    content_type: str
    parameters: Mapping[str, str | int | float | bool]
    estimated_units: Decimal


@dataclass(frozen=True)
class MediaProviderResponse:
    content: bytes
    media_type: str
    billed_units: Decimal
    request_id: str | None = None


@dataclass(frozen=True)
class MediaGatewayResult:
    content: bytes
    media_type: str
    billed_units: Decimal
    provider: Provider
    model: str
    replayed: bool
    cached: bool


class MediaProvider(Protocol):
    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse: ...


class MediaCassetteEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1]
    request_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    task: TaskName
    provider: Provider
    model: str = Field(min_length=1)
    recorded_at: datetime
    response_base64: str
    media_type: str = Field(min_length=1)
    billed_units: Decimal = Field(ge=0, allow_inf_nan=False)
    request_id: str | None = None


class FileMediaCassetteStore:
    def __init__(
        self,
        root: Path,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._root = root
        self._clock = clock

    def path_for(self, request: MediaRequest, provider: Provider, model: str) -> Path:
        return self._root / request.task.value / f"{cassette_key(request, provider, model)}.json"

    async def load(
        self, request: MediaRequest, provider: Provider, model: str
    ) -> MediaProviderResponse:
        key = cassette_key(request, provider, model)
        path = self.path_for(request, provider, model)
        if not path.is_file():
            raise GatewayCassetteMissingError("media replay cassette is unavailable")
        try:
            envelope = MediaCassetteEnvelope.model_validate_json(
                path.read_text(encoding="utf-8")
            )
            content = base64.b64decode(envelope.response_base64, validate=True)
        except (OSError, ValidationError, ValueError) as error:
            raise GatewayReplayError("media replay cassette is invalid") from error
        if (
            envelope.request_hash != key
            or envelope.task != request.task
            or envelope.provider != provider
            or envelope.model != model
        ):
            raise GatewayReplayError("media replay cassette does not match the request")
        return MediaProviderResponse(
            content=content,
            media_type=envelope.media_type,
            billed_units=envelope.billed_units,
            request_id=envelope.request_id,
        )

    async def save(
        self,
        request: MediaRequest,
        provider: Provider,
        model: str,
        response: MediaProviderResponse,
    ) -> None:
        key = cassette_key(request, provider, model)
        path = self.path_for(request, provider, model)
        envelope = MediaCassetteEnvelope(
            version=1,
            request_hash=key,
            task=request.task,
            provider=provider,
            model=model,
            recorded_at=self._clock(),
            response_base64=base64.b64encode(response.content).decode("ascii"),
            media_type=response.media_type,
            billed_units=response.billed_units,
            request_id=response.request_id,
        )
        serialized = json.dumps(
            envelope.model_dump(mode="json"),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        ) + "\n"
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            self._ensure_same(path, envelope)
            return

        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=path.parent,
                prefix=f".{key}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary.write(serialized)
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_path = Path(temporary.name)
            try:
                os.link(temporary_path, path)
            except FileExistsError:
                self._ensure_same(path, envelope)
        except OSError as error:
            raise GatewayReplayError("media cassette could not be saved") from error
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    @staticmethod
    def _ensure_same(path: Path, expected: MediaCassetteEnvelope) -> None:
        try:
            existing = MediaCassetteEnvelope.model_validate_json(
                path.read_text(encoding="utf-8")
            )
        except (OSError, ValidationError) as error:
            raise GatewayReplayError("existing media cassette is invalid") from error
        if existing.model_dump(exclude={"recorded_at"}) != expected.model_dump(
            exclude={"recorded_at"}
        ):
            raise GatewayReplayError("media cassette already exists with different content")


@dataclass(frozen=True)
class _MediaCacheEntry:
    response: MediaProviderResponse
    expires_at: float


class InMemoryMediaCache:
    def __init__(self) -> None:
        self._entries: dict[str, _MediaCacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get(
        self, request: MediaRequest, provider: Provider, model: str
    ) -> MediaProviderResponse | None:
        key = cassette_key(request, provider, model)
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= monotonic():
                del self._entries[key]
                return None
            return entry.response

    async def put(
        self,
        request: MediaRequest,
        provider: Provider,
        model: str,
        response: MediaProviderResponse,
        ttl_seconds: int,
    ) -> None:
        key = cassette_key(request, provider, model)
        async with self._lock:
            self._entries[key] = _MediaCacheEntry(
                response=response,
                expires_at=monotonic() + ttl_seconds,
            )


class MediaGateway:
    def __init__(
        self,
        *,
        mode: GatewayMode,
        configuration: ModelsConfiguration,
        providers: Mapping[Provider, MediaProvider],
        cassettes: FileMediaCassetteStore,
        cache: InMemoryMediaCache | None = None,
        budget: GatewayBudget | None = None,
    ) -> None:
        self._mode = mode
        self._configuration = configuration
        self._providers = dict(providers)
        self._cassettes = cassettes
        self._cache = cache or InMemoryMediaCache()
        self._budget = budget

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        if request.task not in {TaskName.TRANSCRIPTION, TaskName.SPEECH}:
            raise GatewayConfigurationError("task is not a media operation")
        task = self._configuration.tasks[request.task]
        if task.provider != Provider.DEEPGRAM:
            raise GatewayConfigurationError("media task is not routed to Deepgram")
        candidates = (task.model, task.fallback_model)

        for candidate in candidates:
            cached = await self._cache.get(request, task.provider, candidate)
            if cached is not None:
                await self._record_free(request, task.provider, candidate, "cache")
                return _result(cached, task.provider, candidate, self._mode == "replay", True)

        if self._mode == "replay":
            for candidate in candidates:
                try:
                    response = await self._cassettes.load(request, task.provider, candidate)
                except GatewayCassetteMissingError:
                    continue
                await self._cache.put(
                    request, task.provider, candidate, response, task.cache_ttl_seconds
                )
                await self._record_free(request, task.provider, candidate, "replay")
                return _result(response, task.provider, candidate, True, False)
            raise GatewayReplayError("media replay cassette is unavailable")

        provider = self._providers.get(task.provider)
        if provider is None:
            raise GatewayConfigurationError("Deepgram provider is not configured")
        reservation: BudgetReservation | None = None
        if self._budget is not None:
            reservation = await self._budget.reserve(request, task.model)

        selected_model = task.model
        response: MediaProviderResponse | None = None
        for candidate in candidates:
            try:
                response = await provider.execute(
                    MediaProviderRequest(
                        task=request.task,
                        operation=request.operation,
                        model=candidate,
                        content=request.content,
                        content_type=request.content_type,
                        parameters=request.parameters,
                        estimated_units=request.estimated_units,
                    )
                )
                selected_model = candidate
                break
            except GatewayProviderError:
                continue
        if response is None:
            if self._budget is not None and reservation is not None:
                await self._budget.cancel(reservation)
            raise GatewayProviderError("Deepgram provider failed")

        if self._budget is not None and reservation is not None:
            await self._budget.complete_metered(
                reservation,
                request,
                task.provider,
                selected_model,
                self._mode,
                response.billed_units,
            )
        if self._mode == "record":
            await self._cassettes.save(request, task.provider, selected_model, response)
        await self._cache.put(
            request, task.provider, selected_model, response, task.cache_ttl_seconds
        )
        return _result(response, task.provider, selected_model, False, False)

    async def _record_free(
        self,
        request: MediaRequest,
        provider: Provider,
        model: str,
        source: Literal["replay", "cache"],
    ) -> None:
        if self._budget is not None:
            await self._budget.record_free(
                request,
                provider,
                model,
                mode=self._mode,
                source=source,
                input_tokens=0,
                output_tokens=0,
            )


def _result(
    response: MediaProviderResponse,
    provider: Provider,
    model: str,
    replayed: bool,
    cached: bool,
) -> MediaGatewayResult:
    return MediaGatewayResult(
        content=response.content,
        media_type=response.media_type,
        billed_units=response.billed_units,
        provider=provider,
        model=model,
        replayed=replayed,
        cached=cached,
    )


MediaProviderFactory = Callable[[], MediaProvider]


def create_media_gateway(
    settings: Settings,
    configuration: ModelsConfiguration,
    *,
    cassettes: FileMediaCassetteStore | None = None,
    cache: InMemoryMediaCache | None = None,
    budget: GatewayBudget | None = None,
    provider_factories: Mapping[Provider, MediaProviderFactory] | None = None,
) -> MediaGateway:
    providers: dict[Provider, MediaProvider] = {}
    if settings.gateway_mode != "replay":
        factories = dict(provider_factories or _default_media_provider_factories())
        providers = {provider: factory() for provider, factory in factories.items()}
    return MediaGateway(
        mode=settings.gateway_mode,
        configuration=configuration,
        providers=providers,
        cassettes=cassettes or FileMediaCassetteStore(DEFAULT_CASSETTES_ROOT),
        cache=cache,
        budget=budget
        or GatewayBudget(
            configuration,
            FileUsageStore(settings.usage_log_path),
            settings.budget_usd_cap,
        ),
    )


def _default_media_provider_factories() -> Mapping[Provider, MediaProviderFactory]:
    from ..providers.deepgram import DeepgramProvider

    return {Provider.DEEPGRAM: DeepgramProvider}
