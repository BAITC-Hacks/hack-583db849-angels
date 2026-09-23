import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.media import MediaGatewayResult, MediaRequest
from services.ml.app.modules.transcription import TurnTranscriptionService
from services.ml.app.schemas.contracts import TranscribeRequest


def provider_payload(
    *, text: str = "Synthetic candidate answer.", confidence: float = 0.91
) -> bytes:
    return json.dumps(
        {
            "metadata": {"duration": 2.5},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "transcript": text,
                                "confidence": 0.95,
                                "words": [
                                    {
                                        "word": "Synthetic",
                                        "punctuated_word": "Synthetic",
                                        "start": 0.2,
                                        "end": 0.8,
                                        "confidence": 0.97,
                                    },
                                    {
                                        "word": "answer",
                                        "punctuated_word": "answer.",
                                        "start": 0.9,
                                        "end": 2.1,
                                        "confidence": confidence,
                                    },
                                ],
                            }
                        ]
                    }
                ]
            },
        }
    ).encode()


class FakeMediaGateway:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.requests: list[MediaRequest] = []

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        self.requests.append(request)
        return MediaGatewayResult(
            content=self.content,
            media_type="application/json",
            billed_units=Decimal("0.0416666667"),
            provider=Provider.DEEPGRAM,
            model="nova-3",
            replayed=True,
            cached=False,
        )


def request(audio_ref: str = "turns/synthetic.webm") -> TranscribeRequest:
    return TranscribeRequest(
        purpose="turn",
        audioRef=audio_ref,
        language="en",
        speakers=1,
    )


def test_turn_transcription_maps_text_timings_and_lowest_confidence(
    tmp_path: Path,
) -> None:
    audio = tmp_path / "synthetic.webm"
    audio.write_bytes(b"synthetic-webm")
    gateway = FakeMediaGateway(provider_payload(confidence=0.88))

    result = asyncio.run(TurnTranscriptionService(gateway).transcribe(request(), audio))

    assert result.durationSec == 2.5
    assert len(result.turns) == 1
    assert result.turns[0].speaker == "candidate"
    assert result.turns[0].text == "Synthetic candidate answer."
    assert result.turns[0].startSec == 0.2
    assert result.turns[0].endSec == 2.1
    assert result.turns[0].confidence == 0.88
    assert gateway.requests[0].content == b"synthetic-webm"
    assert gateway.requests[0].content_type == "audio/webm"
    assert gateway.requests[0].parameters == {
        "language": "en",
        "speakers": 1,
        "purpose": "turn",
    }
    assert gateway.requests[0].estimated_units == Decimal(1)


def test_empty_recognition_returns_no_turns(tmp_path: Path) -> None:
    audio = tmp_path / "synthetic.ogg"
    audio.write_bytes(b"synthetic-ogg")
    gateway = FakeMediaGateway(provider_payload(text=""))

    result = asyncio.run(TurnTranscriptionService(gateway).transcribe(request(), audio))

    assert result.turns == []
    assert result.durationSec == 2.5
    assert gateway.requests[0].content_type == "audio/ogg"


def test_invalid_provider_payload_is_a_gateway_output_error(tmp_path: Path) -> None:
    audio = tmp_path / "synthetic.webm"
    audio.write_bytes(b"synthetic-webm")

    with pytest.raises(GatewayOutputError, match="invalid"):
        asyncio.run(
            TurnTranscriptionService(FakeMediaGateway(b"not-json")).transcribe(
                request(), audio
            )
        )


def test_unsupported_audio_type_is_rejected_before_gateway_use(tmp_path: Path) -> None:
    audio = tmp_path / "synthetic.wav"
    audio.write_bytes(b"synthetic-wav")
    gateway = FakeMediaGateway(provider_payload())

    with pytest.raises(GatewayOutputError, match="unsupported"):
        asyncio.run(TurnTranscriptionService(gateway).transcribe(request(), audio))

    assert gateway.requests == []
