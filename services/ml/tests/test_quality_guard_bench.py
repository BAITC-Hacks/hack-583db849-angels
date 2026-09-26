"""The M5 bench rejects missing, unsafe, or ungrounded process reports."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path

import pytest

from services.ml.app.schemas.contracts import QualityCheckResult
from services.ml.scripts import quality_guard_bench as bench_module


EXAMPLES = Path(__file__).resolve().parents[3] / "docs/contracts/examples/candidate-a/ml"
INTERVIEW = EXAMPLES / "quality-check-interview.request.json"
CALIBRATION = EXAMPLES / "quality-check-calibration.request.json"


def result(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def test_default_bench_checks_real_route_on_replay() -> None:
    assert bench_module.bench(INTERVIEW, CALIBRATION) == {
        "interview_signals": 3, "calibration_signals": 1, "interviews": 15,
    }


@pytest.mark.parametrize("damage", [
    "missing_question", "invented_quote", "candidate_claim", "empty_recommendation",
    "changed_drift", "unselected_signal", "false_calibration_text",
])
def test_bench_rejects_invalid_reports(monkeypatch: pytest.MonkeyPatch, damage: str) -> None:
    interview = result("quality-check-interview.response.json")
    interview["talkShare"] = {"interviewer": 0.35, "candidate": 0.65}
    calibration = result("quality-check-calibration.response.json")
    if damage == "missing_question":
        interview["signals"].pop(0)
    elif damage == "invented_quote":
        interview["signals"][0]["evidence"][0]["quote"] = "Fabricated interviewer words"
    elif damage == "candidate_claim":
        interview["signals"][0]["message"] = "The candidate has poor leadership."
    elif damage == "empty_recommendation":
        interview["signals"][0]["recommendation"] = ""
    elif damage == "changed_drift":
        calibration["drift"][3]["delta"] = 2.0
    elif damage == "unselected_signal":
        calibration["signals"].append(deepcopy(calibration["signals"][0]))
    elif damage == "false_calibration_text":
        calibration["signals"][0]["message"] = (
            "Values scores run 2.3 above the panel (1.1 against 3.4)."
        )

    def fake_post(_client, request):
        raw = interview if request.kind == "interview" else calibration
        return QualityCheckResult.model_validate(raw)

    monkeypatch.setattr(bench_module, "_post", fake_post)
    with pytest.raises(AssertionError):
        bench_module.bench(INTERVIEW, CALIBRATION)
