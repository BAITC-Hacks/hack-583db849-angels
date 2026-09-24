"""Replay each synthetic voice session into its grounded M3 report over HTTP."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from services.ml.app.schemas.contracts import AssessmentResult, Turn
from services.ml.scripts.quality_bench import BenchFailure, verify_case
from services.ml.scripts.smoke_m2a import HttpTransport, Transport, run as run_voice


ROOT = Path(__file__).resolve().parents[3]


def run(transport: Transport) -> dict[str, Any]:
    assessments = []

    def assess(candidate: str, played: list[dict[str, Any]]) -> None:
        case = ROOT / "seed" / "candidates" / candidate
        reference_turns = [
            Turn.model_validate(item)
            for item in json.loads((case / "transcript.json").read_text(encoding="utf-8"))
        ]
        turns = [Turn.model_validate(item) for item in played]
        if [turn.text for turn in turns if turn.speaker == "candidate"] != [
            turn.text for turn in reference_turns if turn.speaker == "candidate"
        ]:
            raise BenchFailure("voice candidate lines differ from the assessment seed")
        expected = AssessmentResult.model_validate_json(
            (case / "expected-assessment.json").read_text(encoding="utf-8")
        )
        voice_report = _assessment(transport, case.name, turns, "voice")
        verify_case(case, "conflict-resolution", voice_report, expected, turns)
        text_report = _assessment(transport, case.name, turns, "text")
        verify_case(case, "conflict-resolution", text_report, expected, turns)
        if text_report.english.wordsPerMinute is not None or text_report.english.fillerRate is not None:
            raise BenchFailure("accommodated text exposed a speech-only metric")
        if [score.score for score in voice_report.scores] != [
            score.score for score in text_report.scores
        ]:
            raise BenchFailure("accommodation changed leadership scores")
        assessments.append({
            "candidateId": f"candidate-{candidate}",
            "scoresChecked": len(voice_report.scores),
            "quotesChecked": sum(len(score.evidence) for score in voice_report.scores),
        })

    voice = run_voice(transport, on_complete=assess)
    return {
        "mode": "replay",
        "sessions": voice["sessions"],
        "assessments": assessments,
        "requests": voice["requests"] + len(assessments) * 2,
        "voiceLatencyMs": voice["latencyMs"],
    }


def _assessment(
    transport: Transport, candidate: str, turns: list[Turn], mode: str
) -> AssessmentResult:
    status, _, content, _ = transport.request(
        "POST",
        "/internal/v1/simulation/assessment",
        payload={
            "candidateId": f"synthetic-{candidate}",
            "scenarioId": "conflict-resolution",
            "mode": mode,
            "turns": [turn.model_dump(mode="json") for turn in turns],
        },
    )
    if status != 200:
        raise BenchFailure(f"voice-to-report assessment failed: HTTP {status}")
    return AssessmentResult.model_validate_json(content)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    options = parser.parse_args()
    token = os.environ.get("ML_INTERNAL_TOKEN")
    if not token:
        raise SystemExit("ML_INTERNAL_TOKEN is required")
    print(json.dumps(run(HttpTransport(options.base_url, token)), sort_keys=True))
