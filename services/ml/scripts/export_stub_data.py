"""Package frozen stub payloads for service-only Docker builds."""

from __future__ import annotations

import json
from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
OUTPUT_DIR = ROOT / "services" / "ml" / "stub_data"
OUTPUT_JSON = OUTPUT_DIR / "examples.json"
SOURCE_MODELS = ROOT / "config" / "models.json"
OUTPUT_MODELS = OUTPUT_DIR / "models.json"
SOURCE_RUBRIC = ROOT / "config" / "rubric.drive.json"
OUTPUT_RUBRIC = OUTPUT_DIR / "rubric.drive.json"
SOURCE_SCENARIOS = ROOT / "config" / "scenarios"
OUTPUT_SCENARIOS = ROOT / "services" / "ml" / "scenario_data"
SOURCE_EMBEDDING_MODEL = ROOT / "config" / "embedding-model.json"
OUTPUT_EMBEDDING_MODEL = OUTPUT_DIR / "embedding-model.json"
SOURCE_PROMPTS = ROOT / "config" / "prompts"
OUTPUT_PROMPTS = OUTPUT_DIR / "prompts"

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
    "transcribe-turn.request.json",
    "transcribe-turn.response.json",
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
    shutil.copyfile(SOURCE_MODELS, OUTPUT_MODELS)
    shutil.copyfile(SOURCE_RUBRIC, OUTPUT_RUBRIC)
    shutil.copyfile(SOURCE_EMBEDDING_MODEL, OUTPUT_EMBEDDING_MODEL)
    OUTPUT_PROMPTS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(
        SOURCE_PROMPTS / "simulation-actor.md",
        OUTPUT_PROMPTS / "simulation-actor.md",
    )
    OUTPUT_SCENARIOS.mkdir(parents=True, exist_ok=True)
    for destination in OUTPUT_SCENARIOS.glob("*.json"):
        destination.unlink()
    for source in sorted(SOURCE_SCENARIOS.glob("*.json")):
        shutil.copyfile(source, OUTPUT_SCENARIOS / source.name)


if __name__ == "__main__":
    export_stub_data()
