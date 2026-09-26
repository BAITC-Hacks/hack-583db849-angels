"""M5 scale selection is arithmetic; model text cannot change its results."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.errors import ServiceError
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.quality_calibration import (
    CalibrationProposal, CalibrationText, CalibrationWording, compute_drift, talk_share,
)
from services.ml.app.modules.quality_guard import load_quality_policy
from services.ml.app.schemas.contracts import InterviewTurn, QualityCheckRequest


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
POLICY = load_quality_policy()


def example(name: str) -> QualityCheckRequest:
    return QualityCheckRequest.model_validate_json((EXAMPLES / name).read_text(encoding="utf-8"))


class FakeGateway:
    def __init__(self, *outputs: CalibrationProposal) -> None:
        self.outputs = list(outputs)
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.outputs.pop(0), provider="openai", model="synthetic",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def wording(message: str = "Values scores run 1.1 above the panel across 5 interviews (3.4 against 2.3).") -> CalibrationProposal:
    return CalibrationProposal(signals=[CalibrationText(
        competency="V", message=message,
        recommendation="Score two recent Values answers again against the rubric.",
    )])


def test_frozen_calibration_means_and_signal_are_computed_in_code() -> None:
    rows, selected, count = compute_drift(
        example("quality-check-calibration.request.json"), POLICY,
    )
    expected = json.loads((EXAMPLES / "quality-check-calibration.response.json").read_text(encoding="utf-8"))
    assert [row.model_dump(mode="json") for row in rows] == expected["drift"]
    assert count == 15
    assert selected == [{
        "competency": "V", "interviewerMean": 3.4, "panelMean": 2.3,
        "delta": 1.1, "interviewerInterviews": 5, "panelInterviews": 10,
    }]


def test_talk_share_uses_confirmed_duration_arithmetic() -> None:
    request = example("quality-check-interview.request.json")
    assert talk_share(request.transcript).model_dump() == {"interviewer": 0.35, "candidate": 0.65}
    invalid = [InterviewTurn(turnId="iturn_01", speaker="interviewer", text="A", startSec=5, endSec=5)]
    assert talk_share(invalid) is None
    assert talk_share([invalid[0].model_copy(update={"endSec": float("nan")})]) is None


def test_period_filter_excludes_end_and_rejects_bad_dates() -> None:
    request = example("quality-check-calibration.request.json")
    filtered = request.model_copy(update={"periodTo": "2026-09-10"})
    _, selected, count = compute_drift(filtered, POLICY)
    assert count == 1
    assert selected == []
    for bad in ("2026-02-30", "September 9"):
        with pytest.raises(ServiceError) as captured:
            compute_drift(request.model_copy(update={"periodFrom": bad}), POLICY)
        assert captured.value.code == "VALIDATION_ERROR"
    with pytest.raises(ServiceError):
        compute_drift(request.model_copy(update={"periodFrom": "2026-10-01", "periodTo": "2026-09-01"}), POLICY)


def test_null_and_missing_comparison_scores_do_not_invent_means() -> None:
    request = example("quality-check-calibration.request.json")
    target_only = [item for item in request.history if item.interviewerRef == request.interviewerRef]
    rows, selected, count = compute_drift(request.model_copy(update={"history": target_only}), POLICY)
    assert rows == [] and selected == [] and count == 5
    history = [item.model_copy(update={"scores": [
        score.model_copy(update={"score": None}) if score.competency == "V" else score
        for score in item.scores
    ]}) for item in request.history]
    rows, selected, _ = compute_drift(request.model_copy(update={"history": history}), POLICY)
    assert "V" not in [item.competency for item in rows]
    assert selected == []


def test_insufficient_group_observations_do_not_signal() -> None:
    request = example("quality-check-calibration.request.json")
    history = [item for item in request.history if item.interviewerRef != request.interviewerRef]
    history += [item for item in request.history if item.interviewerRef == request.interviewerRef][:2]
    rows, selected, _ = compute_drift(request.model_copy(update={"history": history}), POLICY)
    assert any(row.competency == "V" for row in rows)
    assert selected == []


def test_calibration_model_receives_aggregates_only() -> None:
    request = example("quality-check-calibration.request.json")
    _, selected, _ = compute_drift(request, POLICY)
    gateway = FakeGateway(wording())
    signals = asyncio.run(CalibrationWording(gateway).write(selected))
    assert [signal.kind for signal in signals] == ["scale_drift"]
    assert signals[0].competencies == ["V"]
    sent = gateway.requests[0]
    assert sent.payload["mode"] == "calibration"
    assert sent.payload["drift"][0]["delta"] == 1.1
    assert "history" not in str(sent.payload)
    assert "interviewRef" not in str(sent.payload)
    assert "candidate" not in str(sent.payload)
    assert "interviewerRef" not in str(sent.payload)
    assert sent.payload["attempt"] == 1


def test_bad_calibration_wording_retries_once() -> None:
    request = example("quality-check-calibration.request.json")
    _, selected, _ = compute_drift(request, POLICY)
    gateway = FakeGateway(wording("The applicant should pass."), wording("Values are 2.9 above the panel."))
    with pytest.raises(GatewayOutputError):
        asyncio.run(CalibrationWording(gateway).write(selected))
    assert [item.payload["attempt"] for item in gateway.requests] == [1, 2]


def test_no_selected_drift_makes_no_model_call() -> None:
    gateway = FakeGateway()
    assert asyncio.run(CalibrationWording(gateway).write([])) == []
    assert gateway.requests == []
