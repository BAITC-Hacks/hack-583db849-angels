"""The single routing boundary for all model, speech, and transcription calls."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import replace
import logging
from typing import Any

from ..config import GatewayMode, Settings
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
    ) -> None:
        self._mode = mode
        self._configuration = configuration
        self._providers = dict(providers)
        self._cassettes = cassettes
        self._cache = cache or NullResponseCache()

    async def execute(self, request: GatewayRequest[OutputT]) -> GatewayResult[OutputT]:
        task = self._configuration.tasks[request.task]
        candidates = (task.model, task.fallback_model)

        for candidate in candidates:
            cached = await self._cache.get(request, task.provider, candidate)
            if cached is not None:
                return self._validated_result(
                    request,
                    cached,
                    provider=task.provider,
                    model=candidate,
                    replayed=self._mode == "replay",
                    cached=True,
                )

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
                response = await provider.generate(
                    self._provider_request(request, candidate, task.max_tokens)
                )
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
                    raise
            result = replace(
                result,
                input_tokens=sum(item.input_tokens for item in attempt_responses),
                output_tokens=sum(item.output_tokens for item in attempt_responses),
            )
            break

        if response is None or result is None:
            raise GatewayProviderError("model provider failed")
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


def create_gateway(
    settings: Settings,
    configuration: ModelsConfiguration,
    *,
    cassettes: CassetteStore | None = None,
    cache: ResponseCache | None = None,
    provider_factories: Mapping[Provider, ProviderFactory] | None = None,
) -> ModelGateway:
    """Build a gateway without constructing provider clients in replay mode."""

    stores = cassettes or FileCassetteStore()
    response_cache = cache or InMemoryResponseCache()
    providers: dict[Provider, ModelProvider] = {}
    if settings.gateway_mode != "replay":
        factories = dict(provider_factories or _default_provider_factories())
        providers = {provider: factory() for provider, factory in factories.items()}
    return ModelGateway(
        mode=settings.gateway_mode,
        configuration=configuration,
        providers=providers,
        cassettes=stores,
        cache=response_cache,
    )


def _default_provider_factories() -> Mapping[Provider, ProviderFactory]:
    from ..providers.openai import OpenAIProvider

    return {Provider.OPENAI: OpenAIProvider}
