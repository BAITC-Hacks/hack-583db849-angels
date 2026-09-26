"""Record consented A/B/C surprise-answer transcripts, never their audio.

Run only after a human explicitly authorizes a bounded live Deepgram call.
Raw recordings must live outside this repository and are never copied here.
"""

from __future__ import annotations

import argparse
import asyncio
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.budget import GatewayBudget
from services.ml.app.gateway.media import FileMediaCassetteStore, MediaGateway, MediaProvider
from services.ml.app.gateway.usage import FileUsageStore
from services.ml.app.modules.transcription import TurnTranscriptionService
from services.ml.app.schemas.contracts import TranscribeRequest
from services.ml.app.providers.deepgram import DeepgramProvider


# The gateway reserves the configured $0.30 transcription request limit before
# measuring actual audio minutes, so the local cap must exceed that reservation.
CAP_USD = Decimal("0.35")
MAX_AUDIO_BYTES = 25 * 1024 * 1024
PROFILE_PATTERN = re.compile(r"(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b\d{7,}\b)")


def validate_recordings(recordings: dict[str, Path]) -> dict[str, Path]:
    if set(recordings) != set("abc"):
        raise ValueError("one recording is required for each synthetic candidate")
    checked: dict[str, Path] = {}
    for label, raw_path in recordings.items():
        path = raw_path.resolve(strict=True)
        if path.is_relative_to(ROOT.resolve()):
            raise ValueError("recordings must remain outside the repository")
        if path.suffix.lower() not in {".webm", ".ogg"}:
            raise ValueError("recording must be webm or ogg audio")
        if not path.is_file() or not 0 < path.stat().st_size <= MAX_AUDIO_BYTES:
            raise ValueError("recording size is invalid")
        checked[label] = path
    return checked


def contains_seed_profile(text: str, label: str) -> bool:
    if PROFILE_PATTERN.search(text):
        return True
    snapshot = json.loads((
        ROOT / "seed/candidates" / label / "snapshot.json"
    ).read_text(encoding="utf-8"))
    profile = snapshot["profile"]
    names = [profile["fullName"].split(" (")[0]]
    values = names + [
        profile[key] for key in ("email", "phone", "iin", "region", "school")
    ]
    lowered = text.casefold()
    return any(
        isinstance(value, str) and len(value) >= 4 and value.casefold() in lowered
        for value in values
    )


async def capture(
    recordings: dict[str, Path],
    provider: MediaProvider,
    *,
    cassette_root: Path,
    usage_log_path: Path,
) -> dict[str, float]:
    """Stage all cassettes privately; publish only after all three validate."""

    checked = validate_recordings(recordings)
    config = load_models_configuration()
    durations: dict[str, float] = {}
    with tempfile.TemporaryDirectory(prefix="surprise-stt-") as temporary:
        staged = Path(temporary)
        gateway = MediaGateway(
            mode="record", configuration=config, providers={Provider.DEEPGRAM: provider},
            cassettes=FileMediaCassetteStore(staged),
            budget=GatewayBudget(config, FileUsageStore(usage_log_path), CAP_USD),
        )
        service = TurnTranscriptionService(gateway)
        for label in "abc":
            result = await service.transcribe(TranscribeRequest(
                purpose="surprise", audioRef=checked[label].name,
                language="en", speakers=1,
            ), checked[label])
            if (
                not result.turns or result.durationSec <= 0 or result.durationSec > 90
                or any(turn.speaker != "candidate" for turn in result.turns)
                or any(contains_seed_profile(turn.text, label) for turn in result.turns)
            ):
                raise ValueError("surprise answer transcript is invalid")
            durations[label] = result.durationSec

        generated = sorted((staged / "transcription").glob("*.json"))
        if len(generated) != 3:
            raise ValueError("expected three distinct transcription cassettes")
        target = cassette_root / "transcription"
        target.mkdir(parents=True, exist_ok=True)
        for source in generated:
            destination = target / source.name
            if destination.exists() and destination.read_bytes() != source.read_bytes():
                raise ValueError("a transcription cassette already has different content")
        for source in generated:
            destination = target / source.name
            if not destination.exists():
                shutil.copyfile(source, destination)
    return durations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    for label in "abc":
        parser.add_argument(f"--{label}", required=True, type=Path)
    parser.add_argument("--consent-confirmed", action="store_true")
    parser.add_argument("--live-authorized", action="store_true")
    arguments = parser.parse_args()
    if not arguments.consent_confirmed or not arguments.live_authorized:
        parser.error("human consent and live-call authorization are required")
    if not os.environ.get("DEEPGRAM_API_KEY"):
        parser.error("a spending-limited Deepgram key is required")
    durations = asyncio.run(capture(
        {label: getattr(arguments, label) for label in "abc"},
        DeepgramProvider(),
        cassette_root=ROOT / "fixtures/cassettes",
        usage_log_path=Path(tempfile.gettempdir()) / "surprise-stt-usage.jsonl",
    ))
    print({label: round(duration, 2) for label, duration in durations.items()})


if __name__ == "__main__":
    main()
