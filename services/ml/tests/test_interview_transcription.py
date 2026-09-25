import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.media import MediaGatewayResult, MediaRequest
from services.ml.app.modules.interview_transcription import InterviewTranscriptionService
from services.ml.app.schemas.contracts import TranscribeRequest


def provider_payload(utterances: list[dict] | None = None, duration: float = 8) -> bytes:
    return json.dumps({
        "metadata": {"duration": duration},
        "results": {"utterances": utterances if utterances is not None else [
            {"speaker": 1, "transcript": "What did you change?", "start": 0, "end": 2,
             "words": [{"speaker": 1, "confidence": 0.95}]},
            {"speaker": 0, "transcript": "I listened to both teams.", "start": 2.2,
             "end": 5, "words": [{"speaker": 0, "confidence": 0.81}]},
        ]},
    }).encode()


class FakeMediaGateway:
    def __init__(self, content: bytes, media_type: str = "application/json") -> None:
        self.content = content
        self.media_type = media_type
        self.requests: list[MediaRequest] = []

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        self.requests.append(request)
        return MediaGatewayResult(
            content=self.content, media_type=self.media_type,
            billed_units=Decimal("0.1"), provider=Provider.DEEPGRAM,
            model="nova-3", replayed=True, cached=False,
        )


def transcribe(tmp_path: Path, gateway: FakeMediaGateway):
    audio = tmp_path / "synthetic.ogg"
    audio.write_bytes(b"synthetic-audio")
    request = TranscribeRequest(
        purpose="interview", audioRef="interview/synthetic.ogg", language="en", speakers=2,
    )
    return asyncio.run(InterviewTranscriptionService(gateway).transcribe(request, audio))


def test_swapped_provider_ids_map_first_question_asker_to_interviewer(tmp_path: Path) -> None:
    gateway = FakeMediaGateway(provider_payload())

    result = transcribe(tmp_path, gateway)

    assert [turn.speaker for turn in result.turns] == ["interviewer", "candidate"]
    assert [turn.text for turn in result.turns] == [
        "What did you change?", "I listened to both teams.",
    ]
    assert result.turns[1].confidence == 0.81
    assert result.durationSec == 8
    assert gateway.requests[0].parameters == {
        "language": "en", "speakers": 2, "purpose": "interview", "diarize_model": "latest",
    }
    assert gateway.requests[0].content_type == "audio/ogg"
    assert gateway.requests[0].estimated_units == Decimal(60)


@pytest.mark.parametrize("utterances", [
    [{"speaker": 0, "transcript": "What happened?", "start": 0, "end": 1}],
    [
        {"speaker": 0, "transcript": "Hello.", "start": 0, "end": 1},
        {"speaker": 1, "transcript": "Hello.", "start": 2, "end": 3},
    ],
    [
        {"speaker": 0, "transcript": "What?", "start": 0, "end": 1},
        {"speaker": 1, "transcript": "Okay.", "start": 2, "end": 3},
        {"speaker": 2, "transcript": "Yes.", "start": 4, "end": 5},
    ],
    [
        {"speaker": 0, "transcript": "What happened?", "start": 0, "end": 2},
        {"speaker": 1, "transcript": "Why?", "start": 1, "end": 3},
    ],
    [
        {"speaker": 0, "transcript": "What?", "start": 0, "end": 1},
        {"transcript": "Okay.", "start": 2, "end": 3},
    ],
    [
        {"speaker": 0, "transcript": "What?", "start": 0, "end": 1},
        {"speaker": 1, "transcript": "Okay.", "start": 2, "end": 2},
    ],
    [
        {"speaker": 0, "transcript": "What?", "start": 2, "end": 3},
        {"speaker": 1, "transcript": "Okay.", "start": 1, "end": 2},
    ],
    [
        {"speaker": 0, "transcript": "What?", "start": 0, "end": 1,
         "words": [{"speaker": 1, "confidence": 0.9}]},
        {"speaker": 1, "transcript": "Okay.", "start": 2, "end": 3},
    ],
])
def test_unreliable_speaker_or_timing_fails_closed(
    tmp_path: Path, utterances: list[dict],
) -> None:
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(provider_payload(utterances)))


def test_impossible_duration_and_invalid_json_fail_closed(tmp_path: Path) -> None:
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(provider_payload(duration=3)))
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(b"not-json"))
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(provider_payload(), "audio/ogg"))
