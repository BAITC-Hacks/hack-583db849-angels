import json
import os
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from services.ml.app.audio import resolve_audio_ref
from services.ml.app.config import Settings
from services.ml.app.errors import ServiceError
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayProviderError
from services.ml.app.gateway.media import MediaGatewayResult, MediaRequest
from services.ml.app.main import create_app


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
TOKEN = {"X-Internal-Token": "test-internal-token"}


class TurnExampleGateway:
    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        expected = json.loads(
            (EXAMPLES / "transcribe-turn.response.json").read_text(encoding="utf-8")
        )
        turn = expected["turns"][0]
        words = turn["text"].split()
        payload = {
            "metadata": {"duration": expected["durationSec"]},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "transcript": turn["text"],
                                "confidence": turn["confidence"],
                                "words": [
                                    {
                                        "word": word,
                                        "start": turn["startSec"]
                                        if index == 0
                                        else turn["startSec"] + index,
                                        "end": turn["endSec"]
                                        if index == len(words) - 1
                                        else turn["startSec"] + index + 0.5,
                                        "confidence": turn["confidence"],
                                    }
                                    for index, word in enumerate(words)
                                ],
                            }
                        ]
                    }
                ]
            },
        }
        return MediaGatewayResult(
            content=json.dumps(payload).encode(),
            media_type="application/json",
            billed_units=Decimal("0.5"),
            provider=Provider.DEEPGRAM,
            model="nova-3",
            replayed=True,
            cached=False,
        )


class SyntheticSpeechGateway:
    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        assert request.operation == "speech"
        return MediaGatewayResult(
            content=(ROOT / "fixtures" / "audio" / "silence.mp3").read_bytes(),
            media_type="audio/mpeg",
            billed_units=request.estimated_units,
            provider=Provider.DEEPGRAM,
            model="aura-asteria-en",
            replayed=True,
            cached=False,
        )


class InterviewExampleGateway:
    def __init__(self, *, valid: bool = True, question: bool = True) -> None:
        self.requests: list[MediaRequest] = []
        self.valid = valid
        self.question = question

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        self.requests.append(request)
        utterances = [
            {"speaker": 1, "transcript": "What did you do?", "start": 0, "end": 2,
             "words": [{"speaker": 1, "confidence": 0.92}]},
            {"speaker": 0, "transcript": "I heard both sides.", "start": 2, "end": 4,
             "words": [{"speaker": 0, "confidence": 0.86}]},
        ]
        if not self.valid:
            del utterances[1]["speaker"]
        if not self.question:
            utterances[0]["transcript"] = "Tell me what you did."
        return MediaGatewayResult(
            content=json.dumps({
                "metadata": {"duration": 5}, "results": {"utterances": utterances},
            }).encode(),
            media_type="application/json", billed_units=Decimal("0.1"),
            provider=Provider.DEEPGRAM, model="nova-3", replayed=True, cached=False,
        )


class UnavailableInterviewGateway:
    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        assert request.parameters["purpose"] == "interview"
        raise GatewayProviderError("both synthetic Deepgram models failed")


def test_audio_ref_resolves_a_file_inside_uploads(tmp_path: Path) -> None:
    audio = tmp_path / "candidate-a" / "turn.webm"
    audio.parent.mkdir()
    audio.write_bytes(b"synthetic")

    assert resolve_audio_ref("candidate-a/turn.webm", tmp_path) == audio.resolve()


@pytest.mark.parametrize(
    "audio_ref",
    ["", "../escape.webm", "..\\escape.webm", "/escape.webm", "C:\\escape.webm"],
)
def test_audio_ref_rejects_empty_absolute_and_traversal_paths(
    tmp_path: Path, audio_ref: str
) -> None:
    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref(audio_ref, tmp_path)

    assert caught.value.status_code == 400
    assert caught.value.code == "INVALID_AUDIO_REF"


def test_audio_ref_rejects_a_symlink_escape(tmp_path: Path) -> None:
    outside = tmp_path.parent / f"{tmp_path.name}-outside.webm"
    outside.write_bytes(b"synthetic")
    link = tmp_path / "escape.webm"
    try:
        os.symlink(outside, link)
    except OSError:
        pytest.skip("Creating symlinks is not available for this test user")

    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref("escape.webm", tmp_path)

    assert caught.value.code == "INVALID_AUDIO_REF"


def test_missing_audio_ref_returns_not_found(tmp_path: Path) -> None:
    with pytest.raises(ServiceError) as caught:
        resolve_audio_ref("candidate-a/missing.webm", tmp_path)

    assert caught.value.status_code == 404
    assert caught.value.code == "AUDIO_NOT_FOUND"


def test_speech_returns_the_synthetic_mp3(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    client = TestClient(
        create_app(settings, media_gateway=SyntheticSpeechGateway()),
        raise_server_exceptions=False,
    )

    response = client.post(
        "/internal/v1/speech",
        json={"text": "Synthetic speech fixture.", "voice": "demo"},
        headers=TOKEN,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == (ROOT / "fixtures" / "audio" / "silence.mp3").read_bytes()
    assert response.content


def test_transcribe_rejects_an_unsafe_reference_over_http(tmp_path: Path) -> None:
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    request = json.loads((EXAMPLES / "transcribe.request.json").read_text(encoding="utf-8"))
    request["audioRef"] = "../outside.webm"

    response = client.post("/internal/v1/transcribe", json=request, headers=TOKEN)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_AUDIO_REF"


def test_turn_transcription_uses_the_one_speaker_contract_example(tmp_path: Path) -> None:
    audio = tmp_path / "turns" / "synthetic" / "turn.webm"
    audio.parent.mkdir(parents=True)
    audio.write_bytes(b"synthetic-webm")
    settings = Settings(
        ml_internal_token="test-internal-token",
        uploads_dir=tmp_path,
        gateway_mode="replay",
        budget_usd_cap=Decimal("20"),
        demo_mode=False,
    )
    response = TestClient(
        create_app(settings, media_gateway=TurnExampleGateway()),
        raise_server_exceptions=False,
    ).post(
        "/internal/v1/transcribe",
        json={
            "purpose": "turn",
            "audioRef": "turns/synthetic/turn.webm",
            "language": "en",
            "speakers": 1,
        },
        headers=TOKEN,
    )

    expected = json.loads(
        (EXAMPLES / "transcribe-turn.response.json").read_text(encoding="utf-8")
    )
    assert response.status_code == 200
    assert response.json() == expected


def test_interview_transcription_uses_upload_and_returns_two_roles(tmp_path: Path) -> None:
    audio = tmp_path / "interview" / "synthetic.ogg"
    audio.parent.mkdir()
    audio.write_bytes(b"synthetic-interview-audio")
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
    )
    gateway = InterviewExampleGateway()
    client = TestClient(create_app(settings, media_gateway=gateway), raise_server_exceptions=False)
    body = {"purpose": "interview", "audioRef": "interview/synthetic.ogg",
            "language": "en", "speakers": 2}

    assert client.post("/internal/v1/transcribe", json=body).status_code == 401
    response = client.post("/internal/v1/transcribe", json=body, headers=TOKEN)

    assert response.status_code == 200
    assert [turn["speaker"] for turn in response.json()["turns"]] == [
        "interviewer", "candidate",
    ]
    assert response.json()["turns"][1]["text"] == "I heard both sides."
    assert response.json()["durationSec"] == 5
    assert gateway.requests[0].content == b"synthetic-interview-audio"


def test_interview_provider_outage_returns_safe_503(tmp_path: Path) -> None:
    audio = tmp_path / "synthetic.ogg"
    audio.write_bytes(b"synthetic")
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
    )
    response = TestClient(
        create_app(settings, media_gateway=UnavailableInterviewGateway()),
        raise_server_exceptions=False,
    ).post("/internal/v1/transcribe", json={
        "purpose": "interview", "audioRef": "synthetic.ogg", "speakers": 2,
    }, headers=TOKEN)

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_UNAVAILABLE"
    assert "synthetic Deepgram models" not in response.text


@pytest.mark.parametrize("purpose,speakers", [
    ("interview", 1), ("turn", 2), ("surprise", 2),
])
def test_unsupported_purpose_speaker_pair_is_rejected_before_gateway(
    tmp_path: Path, purpose: str, speakers: int,
) -> None:
    audio = tmp_path / "synthetic.ogg"
    audio.write_bytes(b"synthetic")
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
    )
    gateway = InterviewExampleGateway()
    client = TestClient(create_app(settings, media_gateway=gateway), raise_server_exceptions=False)
    response = client.post("/internal/v1/transcribe", json={
        "purpose": purpose, "audioRef": "synthetic.ogg", "language": "en",
        "speakers": speakers,
    }, headers=TOKEN)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert gateway.requests == []


@pytest.mark.parametrize("gateway", [
    InterviewExampleGateway(valid=False),
    InterviewExampleGateway(question=False),
])
def test_invalid_interview_diarization_is_a_safe_error(
    tmp_path: Path, gateway: InterviewExampleGateway,
) -> None:
    audio = tmp_path / "synthetic.ogg"
    audio.write_bytes(b"synthetic")
    settings = Settings(
        ml_internal_token="test-internal-token", uploads_dir=tmp_path,
        gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
    )
    client = TestClient(
        create_app(settings, media_gateway=gateway),
        raise_server_exceptions=False,
    )
    response = client.post("/internal/v1/transcribe", json={
        "purpose": "interview", "audioRef": "synthetic.ogg", "speakers": 2,
    }, headers=TOKEN)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "AI_INVALID_OUTPUT"
    assert "synthetic" not in str(response.json())
