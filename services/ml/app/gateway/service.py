"""The single routing boundary for all model, speech, and transcription calls."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import replace
import logging
from typing import Any

from ..config import GatewayMode, Settings
from .budget import BudgetReservation, GatewayBudget
from .cache import InMemoryResponseCache, NullResponseCache
from .cassettes import FileCassetteStore
from .config import ModelsConfiguration, Provider
from .errors import (
    GatewayCassetteMissingError,
    GatewayConfigurationError,
    GatewayOutputError,
    GatewayProviderError,
    GatewayReplayError,
)
from .types import (
    CassetteStore,
    GatewayRequest,
    GatewayResult,
    ModelProvider,
    OutputT,
    ProviderRequest,
    ProviderResponse,
    ResponseCache,
)
from .validation import validate_output
from .usage import FileUsageStore


ProviderFactory = Callable[[], ModelProvider]
logger = logging.getLogger(__name__)


class ModelGateway:
    def __init__(
        self,
        *,
        mode: GatewayMode,
        configuration: ModelsConfiguration,
        providers: Mapping[Provider, ModelProvider],
        cassettes: CassetteStore,
        cache: ResponseCache | None = None,
        budget: GatewayBudget | None = None,
    ) -> None:
        self._mode = mode
        self._configuration = configuration
        self._providers = dict(providers)
        self._cassettes = cassettes
        self._cache = cache or NullResponseCache()
        self._budget = budget

    async def execute(self, request: GatewayRequest[OutputT]) -> GatewayResult[OutputT]:
        task = self._configuration.tasks[request.task]
        candidates = (task.model, task.fallback_model)

        for candidate in candidates:
            cached = await self._cache.get(request, task.provider, candidate)
            if cached is not None:
                result = self._validated_result(
                    request,
                    cached,
                    provider=task.provider,
                    model=candidate,
                    replayed=self._mode == "replay",
                    cached=True,
                )
                if self._budget is not None:
                    await self._budget.record_free(
                        request,
                        task.provider,
                        candidate,
                        mode=self._mode,
                        source="cache",
                        input_tokens=cached.input_tokens,
                        output_tokens=cached.output_tokens,
                    )
                return result

        if self._mode == "replay":
            for candidate in candidates:
                try:
                    response = await self._cassettes.load(
                        request, task.provider, candidate
                    )
                except GatewayCassetteMissingError:
                    continue
                result = self._validated_result(
                    request,
                    response,
                    provider=task.provider,
                    model=candidate,
                    replayed=True,
                    cached=False,
                )
                await self._cache.put(
                    request,
                    task.provider,
                    candidate,
                    response,
                    task.cache_ttl_seconds,
                )
                if self._budget is not None:
                    await self._budget.record_free(
                        request,
                        task.provider,
                        candidate,
                        mode="replay",
                        source="replay",
                        input_tokens=response.input_tokens,
                        output_tokens=response.output_tokens,
                    )
                return result
            raise GatewayReplayError("replay cassette is unavailable")

        provider = self._providers.get(task.provider)
        if provider is None:
            raise GatewayConfigurationError(
                f"provider is not configured for task {request.task.value}"
            )

        response: ProviderResponse | None = None
        result: GatewayResult[OutputT] | None = None
        selected_model = task.model
        reservation: BudgetReservation | None = None
        if self._budget is not None:
            reservation = await self._budget.reserve(request, task.model)
        for candidate in candidates:
            attempt_responses: list[ProviderResponse] = []
            selected_model = candidate
            try:
                response = await provider.generate(
                    self._provider_request(request, candidate, task.max_tokens)
                )
                attempt_responses.append(response)
            except GatewayProviderError:
                continue

            try:
                result = self._validated_result(
                    request,
                    response,
                    provider=task.provider,
                    model=selected_model,
                    replayed=False,
                    cached=False,
                )
                self._log_attempt(
                    request, task.provider, candidate, 1, "valid", response
                )
            except GatewayOutputError:
                self._log_attempt(
                    request, task.provider, candidate, 1, "invalid", response
                )
                try:
                    response = await provider.generate(
                        self._provider_request(request, candidate, task.max_tokens)
                    )
                except GatewayProviderError:
                    if self._budget is not None and reservation is not None:
                        await self._budget.complete(
                            reservation,
                            request,
                            task.provider,
                            candidate,
                            self._mode,
                            sum(item.input_tokens for item in attempt_responses),
                            sum(item.output_tokens for item in attempt_responses),
                        )
                    raise
                attempt_responses.append(response)
                try:
                    result = self._validated_result(
                        request,
                        response,
                        provider=task.provider,
                        model=selected_model,
                        replayed=False,
                        cached=False,
                    )
                    self._log_attempt(
                        request, task.provider, candidate, 2, "valid", response
                    )
                except GatewayOutputError:
                    self._log_attempt(
                        request, task.provider, candidate, 2, "invalid", response
                    )
                    if self._budget is not None and reservation is not None:
                        await self._budget.complete(
                            reservation,
                            request,
                            task.provider,
                            candidate,
                            self._mode,
                            sum(item.input_tokens for item in attempt_responses),
                            sum(item.output_tokens for item in attempt_responses),
                        )
                    raise
            result = replace(
                result,
                input_tokens=sum(item.input_tokens for item in attempt_responses),
                output_tokens=sum(item.output_tokens for item in attempt_responses),
            )
            break

        if response is None or result is None:
            if self._budget is not None and reservation is not None:
                await self._budget.cancel(reservation)
            raise GatewayProviderError("model provider failed")
        if self._budget is not None and reservation is not None:
            await self._budget.complete(
                reservation,
                request,
                task.provider,
                selected_model,
                self._mode,
                result.input_tokens,
                result.output_tokens,
            )
        if self._mode == "record":
            await self._cassettes.save(
                request,
                task.provider,
                selected_model,
                response,
            )
        await self._cache.put(
            request,
            task.provider,
            selected_model,
            response,
            task.cache_ttl_seconds,
        )
        return result

    @staticmethod
    def _provider_request(
        request: GatewayRequest[OutputT], model: str, max_tokens: int
    ) -> ProviderRequest:
        return ProviderRequest(
            task=request.task,
            model=model,
            prompt=request.prompt,
            payload=request.payload,
            output_schema=request.output_schema,
            max_tokens=max_tokens,
        )

    @staticmethod
    def _log_attempt(
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        attempt: int,
        outcome: str,
        response: ProviderResponse,
    ) -> None:
        logger.info(
            "model output validation task=%s provider=%s model=%s attempt=%d "
            "outcome=%s input_tokens=%d output_tokens=%d",
            request.task.value,
            provider.value,
            model,
            attempt,
            outcome,
            response.input_tokens,
            response.output_tokens,
        )

    @staticmethod
    def _validated_result(
        request: GatewayRequest[OutputT],
        response: ProviderResponse,
        *,
        provider: Provider,
        model: str,
        replayed: bool,
        cached: bool,
    ) -> GatewayResult[OutputT]:
        output = validate_output(request.output_schema, response.content)
        return GatewayResult(
            output=output,
            provider=provider,
            model=model,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            replayed=replayed,
            cached=cached,
        )


class LazyModelGateway:
    """Construct providers only when a model-backed operation is executed."""

    def __init__(self, factory: Callable[[], ModelGateway]) -> None:
        self._factory = factory
        self._gateway: ModelGateway | None = None

    async def execute(self, request: GatewayRequest[OutputT]) -> GatewayResult[OutputT]:
        if self._gateway is None:
            self._gateway = self._factory()
        return await self._gateway.execute(request)


def create_gateway(
    settings: Settings,
    configuration: ModelsConfiguration,
    *,
    cassettes: CassetteStore | None = None,
    cache: ResponseCache | None = None,
    budget: GatewayBudget | None = None,
    provider_factories: Mapping[Provider, ProviderFactory] | None = None,
) -> ModelGateway:
    """Build a gateway without constructing provider clients in replay mode."""

    stores = cassettes or FileCassetteStore()
    response_cache = cache or InMemoryResponseCache()
    providers: dict[Provider, ModelProvider] = {}
    if settings.gateway_mode != "replay":
        factories = dict(provider_factories or _default_provider_factories())
        providers = {provider: factory() for provider, factory in factories.items()}
    gateway_budget = budget or GatewayBudget(
        configuration,
        FileUsageStore(settings.usage_log_path),
        settings.budget_usd_cap,
    )
    return ModelGateway(
        mode=settings.gateway_mode,
        configuration=configuration,
        providers=providers,
        cassettes=stores,
        cache=response_cache,
        budget=gateway_budget,
    )


def _default_provider_factories() -> Mapping[Provider, ProviderFactory]:
    from ..providers.openai import OpenAIProvider

    return {Provider.OPENAI: OpenAIProvider}
