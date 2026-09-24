import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.config import Settings
from services.ml.app.gateway.budget import GatewayBudget
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import GatewayBudgetError, GatewayProviderError, GatewayReplayError
from services.ml.app.gateway.media import (
    FileMediaCassetteStore,
    InMemoryMediaCache,
    MediaGateway,
    MediaProviderRequest,
    MediaProviderResponse,
    MediaRequest,
    create_media_gateway,
)
from services.ml.app.gateway.usage import FileUsageStore
from services.ml.app.providers.deepgram import DeepgramProvider


class FakeProvider:
    def __init__(self, *, fail_models: set[str] | None = None) -> None:
        self.calls: list[MediaProviderRequest] = []
        self.fail_models = fail_models or set()

    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse:
        self.calls.append(request)
        if request.model in self.fail_models:
            raise GatewayProviderError("synthetic provider failure")
        return MediaProviderResponse(
            content=b"synthetic-mp3",
            media_type="audio/mpeg",
            billed_units=request.estimated_units,
            request_id="synthetic-request",
        )


def speech_request(text: str = "Hello") -> MediaRequest:
    encoded = text.encode("utf-8")
    return MediaRequest(
        task=TaskName.SPEECH,
        operation="speech",
        content=encoded,
        content_type="text/plain; charset=utf-8",
        parameters={"voice": "aura-2-thalia-en"},
        estimated_units=Decimal(len(text)) / Decimal(1000),
    )


def gateway(
    tmp_path: Path,
    provider: FakeProvider,
    *,
    mode: str = "live",
    cap: str = "20",
) -> tuple[MediaGateway, FileUsageStore, FileMediaCassetteStore]:
    configuration = load_models_configuration()
    usage = FileUsageStore(tmp_path / "usage.jsonl")
    budget = GatewayBudget(configuration, usage, Decimal(cap))
    cassettes = FileMediaCassetteStore(tmp_path / "cassettes")
    service = MediaGateway(
        mode=mode,
        configuration=configuration,
        providers={Provider.DEEPGRAM: provider},
        cassettes=cassettes,
        cache=InMemoryMediaCache(),
        budget=budget,
    )
    return service, usage, cassettes


def test_live_media_uses_provider_and_records_metered_cost(tmp_path: Path) -> None:
    provider = FakeProvider()
    service, usage, _ = gateway(tmp_path, provider)

    result = asyncio.run(service.execute(speech_request()))
    records = asyncio.run(usage.records())

    assert result.content == b"synthetic-mp3"
    assert result.media_type == "audio/mpeg"
    assert [call.model for call in provider.calls] == ["aura-2-thalia-en"]
    assert records[0].metered_unit == "thousand_characters"
    assert records[0].metered_units == Decimal("0.005")
    assert records[0].actual_usd == Decimal("0.000150")
    stored = usage.path.read_text(encoding="utf-8")
    assert "Hello" not in stored
    assert "synthetic-mp3" not in stored


def test_media_uses_the_fallback_model_after_provider_failure(tmp_path: Path) -> None:
    provider = FakeProvider(fail_models={"aura-2-thalia-en"})
    service, _, _ = gateway(tmp_path, provider)

    result = asyncio.run(service.execute(speech_request()))

    assert [call.model for call in provider.calls] == [
        "aura-2-thalia-en",
        "aura-asteria-en",
    ]
    assert result.model == "aura-asteria-en"


def test_recorded_media_replays_and_caches_without_provider(tmp_path: Path) -> None:
    provider = FakeProvider()
    recorder, _, cassettes = gateway(tmp_path, provider, mode="record")
    request = speech_request()
    recorded = asyncio.run(recorder.execute(request))
    cassette_path = cassettes.path_for(request, Provider.DEEPGRAM, recorded.model)

    configuration = load_models_configuration()
    usage = FileUsageStore(tmp_path / "replay-usage.jsonl")
    replay = MediaGateway(
        mode="replay",
        configuration=configuration,
        providers={},
        cassettes=cassettes,
        cache=InMemoryMediaCache(),
        budget=GatewayBudget(configuration, usage, Decimal("0")),
    )
    first = asyncio.run(replay.execute(request))
    second = asyncio.run(replay.execute(request))

    assert first.content == recorded.content
    assert first.replayed is True and first.cached is False
    assert second.replayed is True and second.cached is True
    assert len(provider.calls) == 1
    cassette_text = cassette_path.read_text(encoding="utf-8")
    assert "Hello" not in cassette_text
    assert [record.source for record in asyncio.run(usage.records())] == [
        "replay",
        "cache",
    ]


def test_changed_media_content_has_a_different_cassette(tmp_path: Path) -> None:
    store = FileMediaCassetteStore(tmp_path)

    first = store.path_for(speech_request("Hello"), Provider.DEEPGRAM, "voice")
    second = store.path_for(speech_request("Different"), Provider.DEEPGRAM, "voice")

    assert first != second


def test_missing_replay_never_calls_a_provider(tmp_path: Path) -> None:
    provider = FakeProvider()
    service, _, _ = gateway(tmp_path, provider, mode="replay", cap="0")

    with pytest.raises(GatewayReplayError, match="unavailable"):
        asyncio.run(service.execute(speech_request()))

    assert provider.calls == []


def test_replay_does_not_construct_a_provider(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="synthetic-token",
        uploads_dir=tmp_path / "uploads",
        gateway_mode="replay",
        budget_usd_cap=Decimal("0"),
        demo_mode=False,
        usage_log_path=tmp_path / "usage.jsonl",
    )

    def forbidden_provider() -> FakeProvider:
        raise AssertionError("replay must not construct a provider")

    service = create_media_gateway(
        settings,
        load_models_configuration(),
        cassettes=FileMediaCassetteStore(tmp_path / "missing"),
        provider_factories={Provider.DEEPGRAM: forbidden_provider},
    )

    with pytest.raises(GatewayReplayError):
        asyncio.run(service.execute(speech_request()))


def test_media_budget_refuses_before_the_provider_call(tmp_path: Path) -> None:
    provider = FakeProvider()
    service, _, _ = gateway(tmp_path, provider, cap="0.019")

    with pytest.raises(GatewayBudgetError, match="global"):
        asyncio.run(service.execute(speech_request()))

    assert provider.calls == []


class FakeHttpResponse:
    def __init__(self, content: bytes, request_id: str = "request-id") -> None:
        self._content = content
        self.headers = {"dg-request-id": request_id}

    def __enter__(self) -> "FakeHttpResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self._content


def test_deepgram_transcription_adapter_sends_audio_and_reads_duration() -> None:
    seen = []
    body = json.dumps({"metadata": {"duration": 30}, "results": {}}).encode()

    def opener(request, timeout):
        seen.append((request, timeout))
        return FakeHttpResponse(body)

    provider = DeepgramProvider("synthetic-key", opener=opener)
    response = asyncio.run(
        provider.execute(
            MediaProviderRequest(
                task=TaskName.TRANSCRIPTION,
                operation="transcribe",
                model="nova-3",
                content=b"synthetic-webm",
                content_type="audio/webm",
                parameters={"language": "en", "speakers": 1},
                estimated_units=Decimal("1"),
            )
        )
    )

    assert response.content == body
    assert response.billed_units == Decimal("0.5")
    assert seen[0][0].data == b"synthetic-webm"
    assert seen[0][0].get_header("Authorization") == "Token synthetic-key"
    assert "model=nova-3" in seen[0][0].full_url


def test_deepgram_speech_adapter_returns_binary_audio() -> None:
    seen = []

    def opener(request, timeout):
        seen.append((request, timeout))
        return FakeHttpResponse(b"synthetic-mp3")

    provider = DeepgramProvider("synthetic-key", opener=opener)
    response = asyncio.run(
        provider.execute(
            MediaProviderRequest(
                task=TaskName.SPEECH,
                operation="speech",
                model="aura-2-thalia-en",
                content="Hello".encode(),
                content_type="text/plain; charset=utf-8",
                parameters={},
                estimated_units=Decimal("0.005"),
            )
        )
    )

    assert response.content == b"synthetic-mp3"
    assert response.media_type == "audio/mpeg"
    assert response.billed_units == Decimal("0.005")
    assert json.loads(seen[0][0].data) == {"text": "Hello"}
