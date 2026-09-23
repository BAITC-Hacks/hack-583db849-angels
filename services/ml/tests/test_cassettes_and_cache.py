import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path

import pytest
from pydantic import BaseModel, ConfigDict

from services.ml.app.gateway.cache import InMemoryResponseCache
from services.ml.app.gateway.canonical import cassette_key
from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import GatewayReplayError
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import GatewayRequest, ProviderResponse


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str


def gateway_request(prompt: str = "Return JSON.", value: str = "candidate-a"):
    return GatewayRequest(
        task=TaskName.BRIEF,
        prompt=prompt,
        payload={"candidateId": value, "nested": {"b": 2, "a": 1}},
        output_schema=Answer,
    )


def provider_response(value: str = "ok") -> ProviderResponse:
    return ProviderResponse(
        content=json.dumps({"value": value}),
        input_tokens=10,
        output_tokens=2,
        request_id="synthetic-request-id",
    )


def test_canonical_key_is_order_independent_and_input_sensitive() -> None:
    first = gateway_request()
    reordered = GatewayRequest(
        task=TaskName.BRIEF,
        prompt=first.prompt,
        payload={"nested": {"a": 1, "b": 2}, "candidateId": "candidate-a"},
        output_schema=Answer,
    )
    key = cassette_key(first, Provider.OPENAI, "gpt-6-sol")

    assert cassette_key(reordered, Provider.OPENAI, "gpt-6-sol") == key
    assert cassette_key(gateway_request("Changed prompt"), Provider.OPENAI, "gpt-6-sol") != key
    assert cassette_key(gateway_request(value="candidate-b"), Provider.OPENAI, "gpt-6-sol") != key
    assert cassette_key(first, Provider.OPENAI, "gpt-6-luna") != key


def test_file_cassette_round_trip_uses_the_spec_layout(tmp_path: Path) -> None:
    store = FileCassetteStore(
        tmp_path,
        clock=lambda: datetime(2026, 9, 23, tzinfo=timezone.utc),
    )
    request = gateway_request()
    response = provider_response()

    asyncio.run(store.save(request, Provider.OPENAI, "gpt-6-sol", response))
    loaded = asyncio.run(store.load(request, Provider.OPENAI, "gpt-6-sol"))
    path = store.path_for(request, Provider.OPENAI, "gpt-6-sol")

    assert path.parent.name == "brief"
    assert path.name == f"{cassette_key(request, Provider.OPENAI, 'gpt-6-sol')}.json"
    assert loaded == response
    stored_text = path.read_text(encoding="utf-8")
    assert request.prompt not in stored_text
    assert "candidate-a" not in stored_text


def test_changed_request_cannot_reuse_a_cassette(tmp_path: Path) -> None:
    store = FileCassetteStore(tmp_path)
    asyncio.run(
        store.save(
            gateway_request(),
            Provider.OPENAI,
            "gpt-6-sol",
            provider_response(),
        )
    )

    with pytest.raises(GatewayReplayError, match="unavailable"):
        asyncio.run(
            store.load(
                gateway_request(value="candidate-b"),
                Provider.OPENAI,
                "gpt-6-sol",
            )
        )


def test_corrupt_and_mismatched_cassettes_fail_safely(tmp_path: Path) -> None:
    store = FileCassetteStore(tmp_path)
    request = gateway_request()
    path = store.path_for(request, Provider.OPENAI, "gpt-6-sol")
    path.parent.mkdir(parents=True)
    path.write_text("not json", encoding="utf-8")

    with pytest.raises(GatewayReplayError, match="invalid"):
        asyncio.run(store.load(request, Provider.OPENAI, "gpt-6-sol"))

    other_request = gateway_request("other")
    asyncio.run(
        store.save(
            other_request,
            Provider.OPENAI,
            "gpt-6-sol",
            provider_response(),
        )
    )
    other = store.path_for(other_request, Provider.OPENAI, "gpt-6-sol")
    path.write_text(other.read_text(encoding="utf-8"), encoding="utf-8")
    with pytest.raises(GatewayReplayError, match="does not match"):
        asyncio.run(store.load(request, Provider.OPENAI, "gpt-6-sol"))


def test_record_never_overwrites_a_different_cassette(tmp_path: Path) -> None:
    now = datetime(2026, 9, 23, tzinfo=timezone.utc)
    store = FileCassetteStore(tmp_path, clock=lambda: now)
    request = gateway_request()
    asyncio.run(
        store.save(request, Provider.OPENAI, "gpt-6-sol", provider_response())
    )

    with pytest.raises(GatewayReplayError, match="different content"):
        asyncio.run(
            store.save(
                request,
                Provider.OPENAI,
                "gpt-6-sol",
                provider_response("changed"),
            )
        )


def test_recording_the_same_response_again_is_idempotent(tmp_path: Path) -> None:
    moments = iter(
        [
            datetime(2026, 9, 23, tzinfo=timezone.utc),
            datetime(2026, 9, 24, tzinfo=timezone.utc),
        ]
    )
    store = FileCassetteStore(tmp_path, clock=lambda: next(moments))
    request = gateway_request()
    response = provider_response()

    asyncio.run(store.save(request, Provider.OPENAI, "gpt-6-sol", response))
    asyncio.run(store.save(request, Provider.OPENAI, "gpt-6-sol", response))

    assert asyncio.run(store.load(request, Provider.OPENAI, "gpt-6-sol")) == response


def test_cache_hit_and_expiry_use_a_fake_clock() -> None:
    current = 100.0
    cache = InMemoryResponseCache(clock=lambda: current)
    request = gateway_request()
    response = provider_response()

    asyncio.run(cache.put(request, Provider.OPENAI, "gpt-6-sol", response, 10))
    assert asyncio.run(cache.get(request, Provider.OPENAI, "gpt-6-sol")) == response

    current = 110.0
    assert asyncio.run(cache.get(request, Provider.OPENAI, "gpt-6-sol")) is None


def test_gateway_cache_hit_skips_a_second_provider_call() -> None:
    class CountingProvider:
        def __init__(self) -> None:
            self.calls = 0

        async def generate(self, request) -> ProviderResponse:
            del request
            self.calls += 1
            return provider_response()

    provider = CountingProvider()
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=FileCassetteStore(),
        cache=InMemoryResponseCache(),
    )

    first = asyncio.run(gateway.execute(gateway_request()))
    second = asyncio.run(gateway.execute(gateway_request()))

    assert first.cached is False
    assert second.cached is True
    assert provider.calls == 1
