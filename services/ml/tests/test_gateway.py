import asyncio
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import BaseModel, ConfigDict

from services.ml.app.config import Settings
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import (
    GatewayCassetteMissingError,
    GatewayConfigurationError,
    GatewayOutputError,
    GatewayProviderError,
    GatewayReplayError,
)
from services.ml.app.gateway.service import ModelGateway, create_gateway
from services.ml.app.gateway.types import GatewayRequest, ProviderRequest, ProviderResponse
from services.ml.app.providers.openai import OpenAIProvider


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str


def request(task: TaskName = TaskName.BRIEF) -> GatewayRequest[Answer]:
    return GatewayRequest(
        task=task,
        prompt="Return a JSON answer.",
        payload={"candidateId": "candidate-a"},
        output_schema=Answer,
    )


@dataclass
class FakeProvider:
    responses: list[ProviderResponse | Exception]

    def __post_init__(self) -> None:
        self.requests: list[ProviderRequest] = []

    async def generate(self, provider_request: ProviderRequest) -> ProviderResponse:
        self.requests.append(provider_request)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class MemoryCassettes:
    def __init__(self, response: ProviderResponse | None = None) -> None:
        self.response = response
        self.saved: list[tuple[Provider, str, ProviderResponse]] = []

    async def load(self, gateway_request, provider, model) -> ProviderResponse:
        del gateway_request, provider, model
        if self.response is None:
            raise GatewayCassetteMissingError("replay cassette is unavailable")
        return self.response

    async def save(self, gateway_request, provider, model, response) -> None:
        del gateway_request
        self.saved.append((provider, model, response))


def settings(mode: str) -> Settings:
    return Settings(
        ml_internal_token=None,
        uploads_dir=Path("uploads"),
        gateway_mode=mode,
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )


def response(value: str = "ok") -> ProviderResponse:
    return ProviderResponse(
        content=f'{{"value":"{value}"}}',
        input_tokens=12,
        output_tokens=3,
        request_id="synthetic-request-id",
    )


def test_live_routes_through_the_configured_provider() -> None:
    provider = FakeProvider([response()])
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=MemoryCassettes(),
    )

    result = asyncio.run(gateway.execute(request()))

    assert result.output == Answer(value="ok")
    assert result.replayed is False
    assert result.cached is False
    assert provider.requests[0].model == "gpt-6-sol"
    assert provider.requests[0].max_tokens == 1800


def test_live_uses_the_fallback_after_a_safe_provider_failure() -> None:
    provider = FakeProvider([GatewayProviderError("failed"), response("fallback")])
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=MemoryCassettes(),
    )

    result = asyncio.run(gateway.execute(request()))

    assert [item.model for item in provider.requests] == ["gpt-6-sol", "gpt-6-luna"]
    assert result.output.value == "fallback"
    assert result.model == "gpt-6-luna"


def test_record_saves_only_a_validated_response() -> None:
    provider_response = response()
    provider = FakeProvider([provider_response])
    cassettes = MemoryCassettes()
    gateway = ModelGateway(
        mode="record",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=cassettes,
    )

    asyncio.run(gateway.execute(request()))

    assert cassettes.saved == [(Provider.OPENAI, "gpt-6-sol", provider_response)]


def test_invalid_output_is_retried_once_and_then_succeeds(caplog) -> None:
    invalid = ProviderResponse(
        content='{"profile":"must-not-be-logged"}',
        input_tokens=12,
        output_tokens=3,
    )
    provider = FakeProvider([invalid, response("recovered")])
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=MemoryCassettes(),
    )

    with caplog.at_level("INFO"):
        result = asyncio.run(gateway.execute(request()))

    assert result.output.value == "recovered"
    assert result.input_tokens == 24
    assert result.output_tokens == 6
    assert len(provider.requests) == 2
    assert [item.max_tokens for item in provider.requests] == [1800, 1800]
    assert "must-not-be-logged" not in caplog.text
    assert "attempt=1 outcome=invalid" in caplog.text
    assert "attempt=2 outcome=valid" in caplog.text


def test_two_invalid_outputs_fail_after_exactly_two_calls() -> None:
    invalid = ProviderResponse(content="not-json", input_tokens=12, output_tokens=3)
    provider = FakeProvider([invalid, invalid])
    cassettes = MemoryCassettes()
    gateway = ModelGateway(
        mode="record",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=cassettes,
    )

    with pytest.raises(GatewayOutputError, match="schema validation"):
        asyncio.run(gateway.execute(request()))

    assert len(provider.requests) == 2
    assert cassettes.saved == []


def test_replay_never_constructs_or_calls_a_provider() -> None:
    constructed = False

    def forbidden_factory():
        nonlocal constructed
        constructed = True
        raise AssertionError("provider must not be constructed in replay")

    gateway = create_gateway(
        settings("replay"),
        load_models_configuration(),
        cassettes=MemoryCassettes(response("replayed")),
        provider_factories={Provider.OPENAI: forbidden_factory},
    )

    result = asyncio.run(gateway.execute(request()))

    assert constructed is False
    assert result.replayed is True
    assert result.cached is False
    assert result.output.value == "replayed"


def test_missing_replay_never_falls_back_to_live() -> None:
    gateway = create_gateway(
        settings("replay"),
        load_models_configuration(),
        cassettes=MemoryCassettes(),
    )

    with pytest.raises(GatewayReplayError, match="unavailable"):
        asyncio.run(gateway.execute(request()))


def test_live_rejects_a_task_without_its_provider() -> None:
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={},
        cassettes=MemoryCassettes(),
    )

    with pytest.raises(GatewayConfigurationError, match="transcription"):
        asyncio.run(gateway.execute(request(TaskName.TRANSCRIPTION)))


def test_openai_adapter_uses_responses_structured_output() -> None:
    calls: list[dict] = []

    class Responses:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                id="synthetic-openai-id",
                status="completed",
                output_text='{"value":"ok"}',
                usage=SimpleNamespace(input_tokens=7, output_tokens=2),
            )

    provider = OpenAIProvider(SimpleNamespace(responses=Responses()))
    provider_request = ProviderRequest(
        task=TaskName.BRIEF,
        model="gpt-6-sol",
        prompt="Return JSON.",
        payload={"candidateId": "candidate-a"},
        output_schema=Answer,
        max_tokens=123,
    )

    result = asyncio.run(provider.generate(provider_request))

    assert result.input_tokens == 7
    assert result.output_tokens == 2
    assert calls[0]["max_output_tokens"] == 123
    assert calls[0]["text"]["format"]["strict"] is True
    assert calls[0]["input"] == '{"candidateId":"candidate-a"}'


def test_openai_adapter_hides_provider_error_details() -> None:
    class Responses:
        async def create(self, **kwargs):
            del kwargs
            raise RuntimeError("secret candidate content")

    provider = OpenAIProvider(SimpleNamespace(responses=Responses()))
    provider_request = ProviderRequest(
        task=TaskName.BRIEF,
        model="gpt-6-sol",
        prompt="Return JSON.",
        payload={"candidateId": "candidate-a"},
        output_schema=Answer,
        max_tokens=123,
    )

    with pytest.raises(GatewayProviderError, match="OpenAI request failed") as caught:
        asyncio.run(provider.generate(provider_request))

    assert "secret candidate content" not in str(caught.value)
