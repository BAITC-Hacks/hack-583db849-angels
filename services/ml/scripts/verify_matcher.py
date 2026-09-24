"""Offline smoke for the baked MiniLM matcher and the committed scenario."""

from __future__ import annotations

import json
from pathlib import Path
import sys


SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
for path in (SERVICE_ROOT, REPOSITORY_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

try:
    from services.ml.app.modules.matcher import create_local_matcher
    from services.ml.app.scenarios import load_scenario_repository
except ModuleNotFoundError:
    from app.modules.matcher import create_local_matcher
    from app.scenarios import load_scenario_repository


def verify() -> None:
    scenario = load_scenario_repository().get("conflict-resolution")
    if scenario is None:
        raise RuntimeError("conflict-resolution scenario is unavailable")
    matcher = create_local_matcher()
    checked = 0
    for beat in scenario.beats:
        for answer_type in beat.answerTypes:
            for phrase in answer_type.examples:
                result = matcher.match(scenario, beat.beatId, phrase)
                if result.answer_type.answerTypeId != answer_type.answerTypeId:
                    raise RuntimeError(
                        f"{beat.beatId}/{answer_type.answerTypeId} matched "
                        f"{result.answer_type.answerTypeId}"
                    )
                checked += 1
    fallback = matcher.match(
        scenario,
        "opening",
        "The weather forecast says it may rain next month.",
    )
    if not fallback.used_fallback or fallback.answer_type.answerTypeId != "other":
        raise RuntimeError("below-threshold text did not use the opening fallback")

    transcript = json.loads(
        (REPOSITORY_ROOT / "seed/candidates/a/transcript.json").read_text(
            encoding="utf-8"
        )
    )
    candidate_turns = [turn for turn in transcript if turn["speaker"] == "candidate"]
    expected_path = ["opening", "trust", "fairness", "decision", "setback", "end"]
    if len(candidate_turns) != 5:
        raise RuntimeError("candidate A must have five frozen answer lines")
    beat = expected_path[0]
    for turn, expected_next in zip(candidate_turns, expected_path[1:], strict=True):
        result = matcher.match(scenario, beat, turn["text"])
        if result.used_fallback or result.answer_type.next != expected_next:
            raise RuntimeError(
                f"candidate A {turn['turnId']} went from {beat} "
                f"to {result.answer_type.next}, expected {expected_next}"
            )
        beat = result.answer_type.next
    print(f"verified {checked} scenario matcher phrases and candidate A's five-turn path")


if __name__ == "__main__":
    verify()
