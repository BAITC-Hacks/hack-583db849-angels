"""The single routing boundary for all model, speech, and transcription calls."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from pydantic import ValidationError

from ..config import GatewayMode, Settings
from .config import ModelsConfiguration, Provider
from .errors import (
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
)


ProviderFactory = Callable[[], ModelProvider]


class MissingCassetteStore:
    async def load(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
    ) -> ProviderResponse:
        del request, provider, model
        raise GatewayReplayError("replay cassette is unavailable")

    async def save(
        self,
        request: GatewayRequest[Any],
        provider: Provider,
        model: str,
        response: ProviderResponse,
    ) -> None:
        del request, provider, model, response
        raise GatewayReplayError("record cassette store is unavailable")


class ModelGateway:
    def __init__(
        self,
        *,
        mode: GatewayMode,
        configuration: ModelsConfiguration,
        providers: Mapping[Provider, ModelProvider],
        cassettes: CassetteStore,
    ) -> None:
        self._mode = mode
        self._configuration = configuration
        self._providers = dict(providers)
        self._cassettes = cassettes

    async def execute(self, request: GatewayRequest[OutputT]) -> GatewayResult[OutputT]:
        task = self._configuration.tasks[request.task]
        model = task.model

        if self._mode == "replay":
            response = await self._cassettes.load(request, task.provider, model)
            return self._validated_result(
                request,
                response,
                provider=task.provider,
                model=model,
                replayed=True,
            )

        provider = self._providers.get(task.provider)
        if provider is None:
            raise GatewayConfigurationError(
                f"provider is not configured for task {request.task.value}"
            )

        response: ProviderResponse | None = None
        selected_model = model
        for candidate in (task.model, task.fallback_model):
            selected_model = candidate
            try:
                response = await provider.generate(
                    ProviderRequest(
                        task=request.task,
                        model=candidate,
                        prompt=request.prompt,
                        payload=request.payload,
                        output_schema=request.output_schema,
                        max_tokens=task.max_tokens,
                    )
                )
                break
            except GatewayProviderError:
                continue

        if response is None:
            raise GatewayProviderError("model provider failed")

        result = self._validated_result(
            request,
            response,
            provider=task.provider,
            model=selected_model,
            replayed=False,
        )
        if self._mode == "record":
            await self._cassettes.save(
                request,
                task.provider,
                selected_model,
                response,
            )
        return result

    @staticmethod
    def _validated_result(
        request: GatewayRequest[OutputT],
        response: ProviderResponse,
        *,
        provider: Provider,
        model: str,
        replayed: bool,
    ) -> GatewayResult[OutputT]:
        try:
            output = request.output_schema.model_validate_json(response.content)
        except ValidationError as error:
            raise GatewayOutputError("model output failed schema validation") from error
        return GatewayResult(
            output=output,
            provider=provider,
            model=model,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
            replayed=replayed,
        )


def create_gateway(
    settings: Settings,
    configuration: ModelsConfiguration,
    *,
    cassettes: CassetteStore | None = None,
    provider_factories: Mapping[Provider, ProviderFactory] | None = None,
) -> ModelGateway:
    """Build a gateway without constructing provider clients in replay mode."""

    stores = cassettes or MissingCassetteStore()
    providers: dict[Provider, ModelProvider] = {}
    if settings.gateway_mode != "replay":
        factories = dict(provider_factories or _default_provider_factories())
        providers = {provider: factory() for provider, factory in factories.items()}
    return ModelGateway(
        mode=settings.gateway_mode,
        configuration=configuration,
        providers=providers,
        cassettes=stores,
    )


def _default_provider_factories() -> Mapping[Provider, ProviderFactory]:
    from ..providers.openai import OpenAIProvider

    return {Provider.OPENAI: OpenAIProvider}
