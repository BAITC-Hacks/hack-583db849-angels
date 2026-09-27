"""The surprise answer and the video presentation: one speaker, cut into timed segments the brief can quote."""

import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.media import MediaGatewayResult, MediaProviderRequest, MediaRequest
from services.ml.app.modules.answer_transcription import AnswerTranscriptionService
from services.ml.app.providers.deepgram import DeepgramProvider
from services.ml.app.schemas.contracts import TranscribeRequest


def provider_payload(utterances: list[dict] | None = None, duration: float = 40) -> bytes:
    return json.dumps({
        "metadata": {"duration": duration},
        "results": {"utterances": utterances if utterances is not None else [
            {"transcript": "I would ask the team first.", "start": 1.2, "end": 3.4,
             "words": [{"confidence": 0.97}, {"confidence": 0.88}]},
            {"transcript": "Then we would split the work by who knows what.", "start": 4.0, "end": 8.1,
             "confidence": 0.91},
        ]},
    }).encode()


class FakeMediaGateway:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.requests: list[MediaRequest] = []

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        self.requests.append(request)
        return MediaGatewayResult(
            content=self.content, media_type="application/json", billed_units=Decimal("0.7"),
            provider=Provider.DEEPGRAM, model="nova-3", replayed=True, cached=False,
        )


def transcribe(tmp_path: Path, gateway: FakeMediaGateway):
    audio = tmp_path / "answer.wav"
    audio.write_bytes(b"synthetic-audio")
    request = TranscribeRequest(purpose="surprise", audioRef="surprise/answer.wav", language="en", speakers=1)
    return asyncio.run(AnswerTranscriptionService(gateway).transcribe(request, audio))


def test_every_utterance_is_a_timed_segment_of_the_candidate(tmp_path: Path) -> None:
    gateway = FakeMediaGateway(provider_payload())
    result = transcribe(tmp_path, gateway)

    assert [(turn.speaker, turn.text, turn.startSec, turn.endSec) for turn in result.turns] == [
        ("candidate", "I would ask the team first.", 1.2, 3.4),
        ("candidate", "Then we would split the work by who knows what.", 4.0, 8.1),
    ]
    # The lowest word confidence stands for the segment; without words, the utterance's own.
    assert [turn.confidence for turn in result.turns] == [0.88, 0.91]
    assert result.durationSec == 40
    sent = gateway.requests[0]
    assert sent.task == TaskName.TRANSCRIPTION
    assert sent.parameters == {"language": "en", "speakers": 1, "purpose": "surprise"}


def test_a_silent_answer_is_an_answer_with_nothing_said(tmp_path: Path) -> None:
    assert transcribe(tmp_path, FakeMediaGateway(provider_payload([]))).turns == []
    blank = [{"transcript": "  ", "start": 0, "end": 1}]
    assert transcribe(tmp_path, FakeMediaGateway(provider_payload(blank))).turns == []


@pytest.mark.parametrize(
    "utterances",
    [
        [{"transcript": "Backwards.", "start": 5, "end": 4}],
        [{"transcript": "Past the end.", "start": 1, "end": 60}],
        [{"transcript": "Second.", "start": 5, "end": 6}, {"transcript": "First.", "start": 1, "end": 2}],
    ],
    ids=["ends before it starts", "past the recording", "out of order"],
)
def test_impossible_timing_is_refused(tmp_path: Path, utterances: list[dict]) -> None:
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(provider_payload(utterances)))


def test_output_that_is_not_a_transcript_is_refused(tmp_path: Path) -> None:
    with pytest.raises(GatewayOutputError):
        transcribe(tmp_path, FakeMediaGateway(b"not json"))


class FakeHttpResponse:
    def __init__(self, content: bytes) -> None:
        self._content = content
        self.headers = {"dg-request-id": "synthetic-request"}

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self) -> bytes:
        return self._content


def test_deepgram_is_asked_for_utterances_of_one_speaker() -> None:
    seen = []

    def opener(request, timeout):
        seen.append(request)
        return FakeHttpResponse(json.dumps({"metadata": {"duration": 40}, "results": {"utterances": []}}).encode())

    asyncio.run(DeepgramProvider("synthetic-key", opener=opener).execute(MediaProviderRequest(
        task=TaskName.TRANSCRIPTION, operation="transcribe", model="nova-3",
        content=b"synthetic-wav", content_type="audio/wav",
        parameters={"language": "en", "speakers": 1, "purpose": "surprise"},
        estimated_units=Decimal("5"),
    )))
    assert "utterances=true" in seen[0].full_url
    assert "diarize=false" in seen[0].full_url
