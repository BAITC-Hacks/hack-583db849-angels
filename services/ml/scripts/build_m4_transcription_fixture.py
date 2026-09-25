"""Synthesize candidate A's interview and record an offline diarization cassette.

Requires local espeak-ng and ffmpeg. No provider or network call is made.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import wave


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.media import (
    FileMediaCassetteStore,
    MediaGateway,
    MediaProviderRequest,
    MediaProviderResponse,
)
from services.ml.app.modules.interview_transcription import InterviewTranscriptionService
from services.ml.app.schemas.contracts import TranscribeRequest


EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/transcribe.response.json"
AUDIO = ROOT / "fixtures/audio/interview/candidate-a.ogg"
SEED = ROOT / "seed/candidates/a/interview-transcript.json"
CASSETTES = ROOT / "fixtures/cassettes"
RECORDED_AT = datetime(2026, 9, 25, tzinfo=timezone.utc)


def _example() -> dict:
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def generate_audio(example: dict) -> None:
    AUDIO.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temporary:
        temp = Path(temporary)
        with wave.open(str(temp / "joined.wav"), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(22050)
            cursor = 0
            for index, item in enumerate(example["turns"]):
                utterance = temp / f"utterance-{index:02d}.wav"
                voice = "en-us" if item["speaker"] == "interviewer" else "en-gb"
                pitch = "35" if item["speaker"] == "interviewer" else "70"
                subprocess.run(
                    ["espeak-ng", "-v", voice, "-p", pitch, "-s", "190", "-w", str(utterance), item["text"]],
                    check=True,
                )
                with wave.open(str(utterance), "rb") as source:
                    if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (1, 2, 22050):
                        raise RuntimeError("unexpected synthetic voice format")
                    frames = source.readframes(source.getnframes())
                start = round(item["startSec"] * 22050)
                end = round(item["endSec"] * 22050)
                if start < cursor or start + len(frames) // 2 > end:
                    raise RuntimeError(f"synthetic utterance {index} exceeds its time window")
                output.writeframes(b"\0\0" * (start - cursor))
                output.writeframes(frames)
                cursor = start + len(frames) // 2
            duration = round(example["durationSec"] * 22050)
            if cursor > duration:
                raise RuntimeError("synthetic interview exceeds its duration")
            output.writeframes(b"\0\0" * (duration - cursor))
        subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(temp / "joined.wav"),
             "-map_metadata", "-1", "-c:a", "libopus", "-b:a", "24k", str(AUDIO)],
            check=True,
        )
    _canonicalize_ogg_serial(AUDIO)
    if not AUDIO.read_bytes().startswith(b"OggS"):
        raise RuntimeError("synthetic interview is not Ogg audio")


def _canonicalize_ogg_serial(path: Path) -> None:
    """Remove FFmpeg's random Ogg stream serial and repair each page checksum."""
    data = bytearray(path.read_bytes())
    offset = 0
    while offset < len(data):
        if data[offset:offset + 4] != b"OggS" or offset + 27 > len(data):
            raise RuntimeError("invalid generated Ogg page")
        segments = data[offset + 26]
        header_end = offset + 27 + segments
        if header_end > len(data):
            raise RuntimeError("truncated generated Ogg page")
        page_end = header_end + sum(data[offset + 27:header_end])
        if page_end > len(data):
            raise RuntimeError("truncated generated Ogg payload")
        data[offset + 14:offset + 18] = b"M4SA"
        data[offset + 22:offset + 26] = b"\0" * 4
        checksum = 0
        for byte in data[offset:page_end]:
            checksum ^= byte << 24
            for _ in range(8):
                checksum = ((checksum << 1) ^ (0x04C11DB7 if checksum & 0x80000000 else 0)) & 0xFFFFFFFF
        data[offset + 22:offset + 26] = checksum.to_bytes(4, "little")
        offset = page_end
    path.write_bytes(data)


class SyntheticInterviewProvider:
    def __init__(self, example: dict) -> None:
        self._example = example

    async def execute(self, request: MediaProviderRequest) -> MediaProviderResponse:
        if request.operation != "transcribe":
            raise RuntimeError("unexpected media operation")
        utterances = []
        for item in self._example["turns"]:
            speaker = 0 if item["speaker"] == "interviewer" else 1
            utterances.append({
                "speaker": speaker,
                "transcript": item["text"],
                "start": item["startSec"],
                "end": item["endSec"],
                "confidence": 0.98,
                "words": [{"speaker": speaker, "confidence": 0.98}],
            })
        payload = {
            "metadata": {"duration": self._example["durationSec"]},
            "results": {"utterances": utterances},
        }
        return MediaProviderResponse(
            content=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(),
            media_type="application/json",
            billed_units=Decimal(str(self._example["durationSec"])) / Decimal(60),
            request_id="synthetic-m4-interview",
        )


async def build_cassette(example: dict) -> None:
    gateway = MediaGateway(
        mode="record",
        configuration=load_models_configuration(),
        providers={Provider.DEEPGRAM: SyntheticInterviewProvider(example)},
        cassettes=FileMediaCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    result = await InterviewTranscriptionService(gateway).transcribe(
        TranscribeRequest(
            purpose="interview", audioRef="interview/candidate-a.ogg",
            language="en", speakers=2,
        ),
        AUDIO,
    )
    expected = [(item["speaker"], item["text"], item["startSec"], item["endSec"])
                for item in example["turns"]]
    observed = [(item.speaker, item.text, item.startSec, item.endSec) for item in result.turns]
    if observed != expected or result.durationSec != example["durationSec"]:
        raise RuntimeError("synthetic interview cassette does not match contract example")
    transcript = [
        {"turnId": f"iturn_{index:02d}", "speaker": item.speaker,
         "text": item.text, "startSec": item.startSec, "endSec": item.endSec}
        for index, item in enumerate(result.turns, start=1)
    ]
    SEED.write_text(json.dumps(transcript, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    source = _example()
    generate_audio(source)
    asyncio.run(build_cassette(source))
