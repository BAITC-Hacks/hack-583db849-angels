"""Package frozen stub payloads and synthetic audio for service-only Docker builds."""

from __future__ import annotations

import json
from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
OUTPUT_DIR = ROOT / "services" / "ml" / "stub_data"
OUTPUT_JSON = OUTPUT_DIR / "examples.json"
SOURCE_AUDIO = ROOT / "fixtures" / "audio" / "silence.mp3"
OUTPUT_AUDIO = OUTPUT_DIR / "silence.mp3"

EXAMPLE_FILES = (
    "brief.response.json",
    "consistency-after.response.json",
    "consistency-before.response.json",
    "interview-draft.response.json",
    "quality-check-calibration.response.json",
    "quality-check-interview.response.json",
    "scenarios.response.json",
    "simulation-assessment.response.json",
    "simulation-turn.response.json",
    "surprise-question.response.json",
    "transcribe.response.json",
    "usage.response.json",
)


def export_stub_data() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payloads = {
        filename: json.loads((SOURCE / filename).read_text(encoding="utf-8"))
        for filename in EXAMPLE_FILES
    }
    OUTPUT_JSON.write_text(
        json.dumps(payloads, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    shutil.copyfile(SOURCE_AUDIO, OUTPUT_AUDIO)


if __name__ == "__main__":
    export_stub_data()
