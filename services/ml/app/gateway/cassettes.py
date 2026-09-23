"""Validated, deterministic record/replay cassettes stored on the local filesystem."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .canonical import cassette_key
from .config import Provider, TaskName
from .errors import GatewayCassetteMissingError, GatewayReplayError
from .types import GatewayRequest, ProviderResponse


ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CASSETTES_ROOT = ROOT / "fixtures" / "cassettes"


class CassetteEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal[1]
    key: str = Field(pattern=r"^[0-9a-f]{64}$")
    task: TaskName
    provider: Provider
    model: str = Field(min_length=1)
    recorded_at: datetime
    response: str
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    request_id: str | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FileCassetteStore:
    def __init__(
        self,
        root: Path = DEFAULT_CASSETTES_ROOT,
        *,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._root = root
        self._clock = clock

    def path_for(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> Path:
        return self._root / request.task.value / f"{cassette_key(request, provider, model)}.json"

    async def load(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> ProviderResponse:
        key = cassette_key(request, provider, model)
        path = self.path_for(request, provider, model)
        if not path.is_file():
            raise GatewayCassetteMissingError("replay cassette is unavailable")
        try:
            envelope = CassetteEnvelope.model_validate_json(
                path.read_text(encoding="utf-8")
            )
        except (OSError, ValidationError) as error:
            raise GatewayReplayError("replay cassette is invalid") from error
        if (
            envelope.key != key
            or envelope.task != request.task
            or envelope.provider != provider
            or envelope.model != model
        ):
            raise GatewayReplayError("replay cassette does not match the request")
        return ProviderResponse(
            content=envelope.response,
            input_tokens=envelope.input_tokens,
            output_tokens=envelope.output_tokens,
            request_id=envelope.request_id,
        )

    async def save(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        response: ProviderResponse,
    ) -> None:
        key = cassette_key(request, provider, model)
        path = self.path_for(request, provider, model)
        envelope = CassetteEnvelope(
            version=1,
            key=key,
            task=request.task,
            provider=provider,
            model=model,
            recorded_at=self._clock(),
            response=response.content,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
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
            self._ensure_same_existing(path, envelope)
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
                self._ensure_same_existing(path, envelope)
        except OSError as error:
            raise GatewayReplayError("record cassette could not be saved") from error
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    @staticmethod
    def _ensure_same_existing(path: Path, envelope: CassetteEnvelope) -> None:
        try:
            existing = CassetteEnvelope.model_validate_json(
                path.read_text(encoding="utf-8")
            )
        except (OSError, ValidationError) as error:
            raise GatewayReplayError("existing cassette could not be read") from error
        if existing.model_dump(exclude={"recorded_at"}) != envelope.model_dump(
            exclude={"recorded_at"}
        ):
            raise GatewayReplayError("cassette already exists with different content")
