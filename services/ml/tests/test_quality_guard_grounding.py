"""M5 citations and staff-only language are checked before any HTTP output."""

from __future__ import annotations

import logging

import pytest
from pydantic import ValidationError

from services.ml.app.modules.quality_guard import (
    ground_question_signals,
    interviewer_sources,
    load_quality_policy,
    safe_process_text,
)
from services.ml.app.schemas.contracts import Evidence, InterviewTurn, QualitySignal


POLICY = load_quality_policy()
INTERVIEWER = InterviewTurn(
    turnId="iturn_01", speaker="interviewer",
    text="You would agree that finishing on time matters most, right?",
    startSec=0, endSec=4,
)
CANDIDATE = InterviewTurn(
    turnId="iturn_02", speaker="candidate", text="I disagree with that.",
    startSec=5, endSec=8,
)


def question(source_id: str, quote: str) -> QualitySignal:
    return QualitySignal(
        kind="leading_question", message="The question suggests its own answer.",
        recommendation="Ask openly about the reasoning.",
        evidence=[Evidence(source="interview_turn", sourceId=source_id, quote=quote)],
    )


def test_verified_interviewer_quote_survives_unchanged() -> None:
    signal = question(INTERVIEWER.turnId, "You would agree that finishing on time matters most, right?")
    grounded = ground_question_signals([signal], [INTERVIEWER, CANDIDATE], POLICY)
    assert grounded.signals == (signal,)
    assert (grounded.submitted, grounded.dropped, grounded.majority_dropped) == (1, 0, False)


@pytest.mark.parametrize("source_id,quote", [
    ("iturn_01", "You would agree that finishing on time matters most, right!"),
    ("iturn_01", "you would agree that finishing on time matters most, right?"),
    ("iturn_01", "Invented question"),
    ("iturn_02", "I disagree with that."),
    ("iturn_99", "Invented question"),
])
def test_unsupported_or_candidate_quote_is_dropped(source_id: str, quote: str) -> None:
    grounded = ground_question_signals([question(source_id, quote)], [INTERVIEWER, CANDIDATE], POLICY)
    assert grounded.signals == ()
    assert grounded.majority_dropped


def test_normalization_matches_spec_without_weakened_case_or_punctuation() -> None:
    quote = "You would agree that finishing on time matters most, right?"
    spaced = INTERVIEWER.model_copy(update={"text": "You would agree  that finishing on time matters most, right?"})
    assert ground_question_signals([question("iturn_01", quote)], [spaced], POLICY).signals


def test_majority_threshold_and_coverage_shape() -> None:
    valid = question("iturn_01", INTERVIEWER.text)
    invalid = question("iturn_02", CANDIDATE.text)
    half = ground_question_signals([valid, invalid], [INTERVIEWER, CANDIDATE], POLICY)
    majority = ground_question_signals([valid, invalid, invalid], [INTERVIEWER, CANDIDATE], POLICY)
    assert not half.majority_dropped
    assert majority.majority_dropped
    gap = QualitySignal(kind="coverage_gap", message="Vision was not covered.",
                        recommendation="Ask about longer-term effects.", competencies=["I"])
    assert ground_question_signals([gap], [INTERVIEWER], POLICY).signals == (gap,)
    assert ground_question_signals([gap.model_copy(update={"evidence": valid.evidence})], [INTERVIEWER], POLICY).dropped == 1


def test_policy_rejects_candidate_claims_and_allows_rubric_process_language() -> None:
    assert safe_process_text("Score two recent Values answers again against the rubric.", POLICY)
    assert not safe_process_text("The candidate should pass.", POLICY)
    assert not safe_process_text("She is suitable.", POLICY)
    assert ground_question_signals([
        question("iturn_01", INTERVIEWER.text).model_copy(
            update={"recommendation": "Reject the applicant."}
        )
    ], [INTERVIEWER], POLICY).dropped == 1


def test_duplicate_ids_rejected_even_across_speakers() -> None:
    with pytest.raises(ValueError, match="duplicate"):
        interviewer_sources([INTERVIEWER, CANDIDATE.model_copy(update={"turnId": "iturn_01"})])


def test_rejected_evidence_logs_no_quote(caplog: pytest.LogCaptureFixture) -> None:
    secret = "Synthetic private marker"
    with caplog.at_level(logging.WARNING):
        ground_question_signals([question("iturn_01", secret)], [INTERVIEWER], POLICY)
    assert secret not in caplog.text


def test_schema_rejects_invalid_competency() -> None:
    with pytest.raises(ValidationError):
        QualitySignal(kind="coverage_gap", message="A gap.", recommendation="Ask a question.", competencies=["X"])
