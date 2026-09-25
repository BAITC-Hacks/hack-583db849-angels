import asyncio
import logging

import pytest

from services.ml.app.errors import ServiceError
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.modules.interview_draft import InterviewDraftService
from services.ml.app.schemas.contracts import (
    DraftRequest, DraftResult, DriveScore, Evidence, InterviewNote,
)


def request(*, empty: bool = False) -> DraftRequest:
    return DraftRequest.model_validate({
        "candidateId": "synthetic-candidate",
        "transcript": [] if empty else [
            {"turnId": "iturn_01", "speaker": "interviewer",
             "text": "I led the team alone.", "startSec": 0, "endSec": 2},
            {"turnId": "iturn_02", "speaker": "candidate",
             "text": "I asked each owner to review the plan.", "startSec": 3, "endSec": 8},
        ],
        "notes": [],
    })


def evidence(quote: str, source_id: str = "iturn_02") -> Evidence:
    return Evidence(source="interview_turn", sourceId=source_id, quote=quote)


def score(code: str, *pieces: Evidence, rationale: str = "Invented: wealthy family") -> DriveScore:
    return DriveScore(
        competency=code, score=2, confidence="medium", rationale=rationale,
        evidence=list(pieces),
    )


def null(code: str) -> DriveScore:
    return DriveScore(
        competency=code, score=None, confidence=None, rationale=None, evidence=[],
    )


def proposal(*, d: DriveScore | None = None, r: DriveScore | None = None) -> DraftResult:
    return DraftResult(scores=[
        d or null("D"), r or null("R"), null("I"), null("V"), null("E"),
    ])


class FakeGenerator:
    def __init__(self, responses: list[DraftResult]) -> None:
        self.responses = responses
        self.attempts: list[int] = []

    async def generate(self, request: DraftRequest, *, attempt: int = 1) -> DraftResult:
        del request
        self.attempts.append(attempt)
        return self.responses[len(self.attempts) - 1]


def test_verified_quote_survives_but_invented_model_rationale_does_not() -> None:
    generator = FakeGenerator([
        proposal(d=score("D", evidence("I asked each owner"))),
    ])
    output = asyncio.run(InterviewDraftService(generator).prepare(request()))

    assert output.scores[0].score == 2
    assert output.scores[0].evidence == [evidence("I asked each owner")]
    assert output.scores[0].rationale == 'The cited candidate response says: "I asked each owner"'
    assert "wealthy" not in str(output.model_dump())
    assert generator.attempts == [1]


def test_interviewer_speech_and_fabrication_null_unsupported_score(caplog) -> None:
    generator = FakeGenerator([
        proposal(
            d=score("D", evidence("I led the team alone.", "iturn_01")),
            r=score("R", evidence("I asked each owner")),
        ),
    ])
    with caplog.at_level(logging.WARNING):
        output = asyncio.run(InterviewDraftService(generator).prepare(request()))

    assert generator.attempts == [1]  # exactly half, not a majority
    assert output.scores[0].model_dump() == null("D").model_dump()
    assert output.scores[1].score == 2
    assert "I led the team alone" not in caplog.text
    assert "iturn_01" in caplog.text


def test_majority_invalid_retries_once_then_accepts_valid_output() -> None:
    generator = FakeGenerator([
        proposal(d=score("D", evidence("Fabricated quote"))),
        proposal(d=score("D", evidence("I asked each owner"))),
    ])
    output = asyncio.run(InterviewDraftService(generator).prepare(request()))
    assert generator.attempts == [1, 2]
    assert output.scores[0].score == 2


def test_second_majority_failure_maps_to_safe_gateway_error() -> None:
    generator = FakeGenerator([
        proposal(d=score("D", evidence("Fabricated quote"))),
        proposal(d=score("D", evidence("Fabricated quote"))),
    ])
    with pytest.raises(GatewayOutputError, match="evidence"):
        asyncio.run(InterviewDraftService(generator).prepare(request()))
    assert generator.attempts == [1, 2]


def test_empty_sources_return_five_nulls_without_model_call() -> None:
    generator = FakeGenerator([])
    output = asyncio.run(InterviewDraftService(generator).prepare(request(empty=True)))
    assert output.scores == [null(code) for code in "DRIVE"]
    assert generator.attempts == []


def test_note_evidence_is_allowed_but_null_score_has_no_leftover_evidence() -> None:
    supplied = request(empty=True)
    supplied.notes = [InterviewNote(id="note_01", text="Candidate described reviewing the plan.")]
    model_null = null("R").model_copy(update={
        "evidence": [Evidence(source="interview_note", sourceId="note_01", quote="reviewing the plan")],
    })
    generator = FakeGenerator([proposal(
        d=score("D", Evidence(
            source="interview_note", sourceId="note_01", quote="reviewing the plan",
        )),
        r=model_null,
    )])

    output = asyncio.run(InterviewDraftService(generator).prepare(supplied))

    assert output.scores[0].rationale == 'The cited interview note says: "reviewing the plan"'
    assert output.scores[1].model_dump() == null("R").model_dump()


def test_duplicate_ids_get_422_before_model_call() -> None:
    broken = request()
    broken.notes = [InterviewNote(id="iturn_01", text="Ambiguous")]
    generator = FakeGenerator([])
    with pytest.raises(ServiceError) as caught:
        asyncio.run(InterviewDraftService(generator).prepare(broken))
    assert caught.value.status_code == 422
    assert generator.attempts == []
