import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.config import Settings
from services.ml.app.gateway.budget import GatewayBudget
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.errors import (
    GatewayBudgetError,
    GatewayConfigurationError,
    GatewayProviderError,
    GatewayReplayError,
)
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


def interview_request() -> MediaRequest:
    return MediaRequest(
        task=TaskName.TRANSCRIPTION,
        operation="transcribe",
        content=b"synthetic-interview-webm",
        content_type="audio/webm",
        parameters={
            "language": "en", "speakers": 2,
            "purpose": "interview", "diarize_model": "latest",
        },
        estimated_units=Decimal(60),
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
    assert [call.model for call in provider.calls] == ["aura-asteria-en"]
    assert records[0].metered_unit == "thousand_characters"
    assert records[0].metered_units == Decimal("0.005")
    # Aura 1: $0.015 per thousand characters.
    assert records[0].actual_usd == Decimal("0.000075")
    stored = usage.path.read_text(encoding="utf-8")
    assert "Hello" not in stored
    assert "synthetic-mp3" not in stored


def test_media_uses_the_fallback_model_after_provider_failure(tmp_path: Path) -> None:
    provider = FakeProvider(fail_models={"aura-asteria-en"})
    service, _, _ = gateway(tmp_path, provider)

    result = asyncio.run(service.execute(speech_request()))

    assert [call.model for call in provider.calls] == [
        "aura-asteria-en",
        "aura-2-thalia-en",
    ]
    assert result.model == "aura-2-thalia-en"


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


def test_interview_budget_covers_sixty_minutes_and_fallback(tmp_path: Path) -> None:
    provider = FakeProvider(fail_models={"nova-3"})
    service, usage, _ = gateway(tmp_path, provider)

    result = asyncio.run(service.execute(interview_request()))

    assert result.model == "nova-2"
    assert [call.model for call in provider.calls] == ["nova-3", "nova-2"]
    assert asyncio.run(usage.records())[0].actual_usd == Decimal("0.2580")


def test_interview_both_models_failing_is_provider_unavailable(tmp_path: Path) -> None:
    provider = FakeProvider(fail_models={"nova-3", "nova-2"})
    service, _, _ = gateway(tmp_path, provider)

    with pytest.raises(GatewayProviderError, match="Deepgram provider failed"):
        asyncio.run(service.execute(interview_request()))

    assert [call.model for call in provider.calls] == ["nova-3", "nova-2"]


def test_interview_global_cap_blocks_provider_before_call(tmp_path: Path) -> None:
    provider = FakeProvider()
    service, _, _ = gateway(tmp_path, provider, cap="0.29")

    with pytest.raises(GatewayBudgetError, match="global"):
        asyncio.run(service.execute(interview_request()))

    assert provider.calls == []


def test_interview_diarizer_option_is_part_of_replay_key(tmp_path: Path) -> None:
    store = FileMediaCassetteStore(tmp_path)
    first = interview_request()
    changed = MediaRequest(
        task=first.task,
        operation=first.operation,
        content=first.content,
        content_type=first.content_type,
        parameters={**first.parameters, "diarize_model": "v2"},
        estimated_units=first.estimated_units,
    )

    assert store.path_for(first, Provider.DEEPGRAM, "nova-3") != store.path_for(
        changed, Provider.DEEPGRAM, "nova-3"
    )


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
    assert "diarize=false" in seen[0][0].full_url


def test_deepgram_interview_adapter_requests_diarized_utterances() -> None:
    seen = []
    body = json.dumps({"metadata": {"duration": 186}, "results": {}}).encode()

    def opener(request, timeout):
        seen.append(request)
        return FakeHttpResponse(body)

    provider = DeepgramProvider("synthetic-key", opener=opener)
    request = interview_request()
    asyncio.run(provider.execute(MediaProviderRequest(
        task=request.task, operation=request.operation, model="nova-3",
        content=request.content, content_type=request.content_type,
        parameters=request.parameters, estimated_units=request.estimated_units,
    )))

    assert len(seen) == 1
    assert "diarize_model=latest" in seen[0].full_url
    assert "utterances=true" in seen[0].full_url
    assert "diarize=true" not in seen[0].full_url
    assert seen[0].data == request.content


def test_deepgram_nova_2_fallback_uses_legacy_diarization_only() -> None:
    seen = []
    body = json.dumps({"metadata": {"duration": 186}, "results": {}}).encode()

    def opener(request, timeout):
        seen.append(request)
        return FakeHttpResponse(body)

    provider = DeepgramProvider("synthetic-key", opener=opener)
    request = interview_request()
    asyncio.run(provider.execute(MediaProviderRequest(
        task=request.task, operation=request.operation, model="nova-2",
        content=request.content, content_type=request.content_type,
        parameters=request.parameters, estimated_units=request.estimated_units,
    )))

    assert len(seen) == 1
    assert "model=nova-2" in seen[0].full_url
    assert "diarize=true" in seen[0].full_url
    assert "diarize_model=" not in seen[0].full_url
    assert "utterances=true" in seen[0].full_url


def test_deepgram_rejects_interview_without_keyed_diarizer() -> None:
    provider = DeepgramProvider("synthetic-key", opener=lambda *_: pytest.fail("called"))
    request = interview_request()
    with pytest.raises(GatewayConfigurationError, match="diarization"):
        asyncio.run(provider.execute(MediaProviderRequest(
            task=request.task, operation=request.operation, model="nova-3",
            content=request.content, content_type=request.content_type,
            parameters={"language": "en", "speakers": 2, "purpose": "interview"},
            estimated_units=request.estimated_units,
        )))


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


@pytest.mark.parametrize(
    ("model", "voice", "spoken"),
    [
        ("aura-2-thalia-en", "aura-2-apollo-en", "aura-2-apollo-en"),
        # The fallback model is the other generation: it speaks in its own voice.
        ("aura-asteria-en", "aura-2-apollo-en", "aura-asteria-en"),
        # The first scenario's Aura 1 voice keeps the Aura 2 model it has always had.
        ("aura-2-thalia-en", "aura-asteria-en", "aura-2-thalia-en"),
    ],
)
def test_deepgram_speaks_in_the_character_voice_of_the_routed_generation(model: str, voice: str, spoken: str) -> None:
    seen = []

    def opener(request, timeout):
        seen.append(request)
        return FakeHttpResponse(b"synthetic-mp3")

    provider = DeepgramProvider("synthetic-key", opener=opener)
    asyncio.run(provider.execute(MediaProviderRequest(
        task=TaskName.SPEECH, operation="speech", model=model, content=b"Hello there.",
        content_type="text/plain; charset=utf-8", parameters={"voice": voice}, estimated_units=Decimal("0.012"),
    )))
    assert f"model={spoken}&" in seen[0].full_url

