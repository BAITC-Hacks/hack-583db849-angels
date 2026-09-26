"""The opt-in cassette recorder never commits audio or unvalidated output."""

from __future__ import annotations

import asyncio
from decimal import Decimal
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import load_models_configuration
from services.ml.app.gateway.media import (
    FileMediaCassetteStore, MediaGateway, MediaProviderRequest,
    MediaProviderResponse,
)
from services.ml.app.modules.transcription import TurnTranscriptionService
from services.ml.app.schemas.contracts import TranscribeRequest
from services.ml.scripts.record_surprise_answer_cassettes import (
    capture, contains_seed_profile, validate_recordings,
)


class SyntheticTranscriptionProvider:
    def __init__(self, *, invalid_duration: bool = False) -> None:
        self.requests: list[MediaProviderRequest] = []
        self.invalid_duration = invalid_duration

    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse:
        self.requests.append(request)
        label = request.content.decode("ascii").split("-")[-1]
        duration = 91 if self.invalid_duration and label == "c" else 5
        text = f"Synthetic answer about project {label}."
        payload = {
            "metadata": {"duration": duration},
            "results": {"channels": [{"alternatives": [{
                "transcript": text, "confidence": 0.91,
                "words": [{"word": "Synthetic", "start": 0.1, "end": 4.0,
                           "confidence": 0.91}],
            }]}]},
        }
        return MediaProviderResponse(
            content=json.dumps(payload).encode(), media_type="application/json",
            billed_units=Decimal(duration) / Decimal(60),
            request_id="synthetic-stt-test",
        )


def recordings(tmp_path: Path) -> dict[str, Path]:
    paths = {}
    for label in "abc":
        path = tmp_path / f"answer-{label}.ogg"
        path.write_bytes(f"synthetic-audio-{label}".encode())
        paths[label] = path
    return paths


def test_capture_stages_three_transcript_only_cassettes(tmp_path: Path) -> None:
    paths = recordings(tmp_path)
    provider = SyntheticTranscriptionProvider()
    cassette_root = tmp_path / "cassettes"
    durations = asyncio.run(capture(
        paths, provider, cassette_root=cassette_root,
        usage_log_path=tmp_path / "usage.jsonl",
    ))
    assert durations == {label: 5 for label in "abc"}
    assert len(provider.requests) == 3
    files = list((cassette_root / "transcription").glob("*.json"))
    assert len(files) == 3
    for path in files:
        cassette = json.loads(path.read_text(encoding="utf-8"))
        assert cassette["task"] == "transcription"
        assert cassette["media_type"] == "application/json"
        assert "synthetic-audio" not in path.read_text(encoding="utf-8")

    replay = MediaGateway(
        mode="replay", configuration=load_models_configuration(), providers={},
        cassettes=FileMediaCassetteStore(cassette_root),
    )
    for label, path in paths.items():
        result = asyncio.run(TurnTranscriptionService(replay).transcribe(
            TranscribeRequest(purpose="surprise", audioRef=path.name, speakers=1),
            path,
        ))
        assert result.turns[0].speaker == "candidate"
        assert result.turns[0].text == f"Synthetic answer about project {label}."


def test_failed_capture_publishes_no_cassettes(tmp_path: Path) -> None:
    cassette_root = tmp_path / "cassettes"
    with pytest.raises(ValueError, match="transcript is invalid"):
        asyncio.run(capture(
            recordings(tmp_path), SyntheticTranscriptionProvider(invalid_duration=True),
            cassette_root=cassette_root, usage_log_path=tmp_path / "usage.jsonl",
        ))
    assert not list(cassette_root.rglob("*.json"))


def test_recording_validation_requires_all_three_audio_files(tmp_path: Path) -> None:
    paths = recordings(tmp_path)
    with pytest.raises(ValueError, match="each synthetic candidate"):
        validate_recordings({"a": paths["a"]})
    paths["b"] = tmp_path / "answer-b.mp4"
    paths["b"].write_bytes(b"synthetic-video")
    with pytest.raises(ValueError, match="webm or ogg"):
        validate_recordings(paths)


def test_cassette_capture_rejects_profile_text() -> None:
    assert contains_seed_profile("Candidate A described a robot.", "a")
    assert contains_seed_profile("Contact candidate.b@example.test.", "b")
    assert not contains_seed_profile("I tested the project with my team.", "c")
