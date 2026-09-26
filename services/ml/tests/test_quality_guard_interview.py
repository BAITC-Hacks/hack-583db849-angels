"""The M5 gateway sees process context; only interviewer speech is evidence."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from services.ml.app.gateway.config import TaskName
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.quality_guard import InterviewQuestionAnalyzer, QuestionProposal
from services.ml.app.schemas.contracts import Evidence, QualityCheckRequest, QualitySignal


ROOT = Path(__file__).resolve().parents[3]
EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/quality-check-interview.request.json"


class FakeGateway:
    def __init__(self, *outputs: QuestionProposal) -> None:
        self.outputs = list(outputs)
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.outputs.pop(0), provider="openai", model="synthetic",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def example() -> QualityCheckRequest:
    return QualityCheckRequest.model_validate(json.loads(EXAMPLE.read_text(encoding="utf-8")))


def leading(source_id: str = "iturn_03", quote: str | None = None) -> QualitySignal:
    return QualitySignal(
        kind="leading_question", message="The question suggests its own answer.",
        recommendation="Ask openly about what mattered and why.",
        evidence=[Evidence(source="interview_turn", sourceId=source_id,
                           quote=quote or "You would agree that finishing on time matters most, right?")],
    )


def test_planted_signals_and_model_boundary() -> None:
    proposed = QuestionProposal(signals=[
        leading(),
        QualitySignal(
            kind="off_limits_question",
            message="The question concerns family background.",
            recommendation="Remove the question and return to the rubric.",
            evidence=[Evidence(source="interview_turn", sourceId="iturn_07",
                               quote="What do your parents do for a living?")],
        ),
        QualitySignal(kind="coverage_gap", message="Vision and Values were not explored.",
                      recommendation="Ask open questions about I and V.", competencies=["I", "V"]),
    ])
    gateway = FakeGateway(proposed)
    result = asyncio.run(InterviewQuestionAnalyzer(gateway).analyze(example()))
    assert [item.kind for item in result] == ["leading_question", "off_limits_question", "coverage_gap"]
    sent = gateway.requests[0]
    assert sent.task == TaskName.QUALITY_CHECK
    assert sent.output_schema is QuestionProposal
    assert "candidateId" not in str(sent.payload)
    assert "profile" not in str(sent.payload)
    assert sent.payload["transcript"][2] == {
        "turnId": "iturn_03", "speaker": "interviewer",
        "text": "You would agree that finishing on time matters most, right?",
    }
    assert "startSec" not in str(sent.payload)


def test_majority_invalid_retries_once_then_returns_safe_error() -> None:
    invalid = QuestionProposal(signals=[leading("iturn_99"), leading("iturn_98")])
    gateway = FakeGateway(invalid, invalid)
    with pytest.raises(GatewayOutputError):
        asyncio.run(InterviewQuestionAnalyzer(gateway).analyze(example()))
    assert [item.payload["attempt"] for item in gateway.requests] == [1, 2]


def test_empty_proposal_is_valid() -> None:
    gateway = FakeGateway(QuestionProposal(signals=[]))
    assert asyncio.run(InterviewQuestionAnalyzer(gateway).analyze(example())) == []
    assert len(gateway.requests) == 1
