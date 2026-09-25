import logging

import pytest

from services.ml.app.evidence import interview_sources, verify_evidence, verify_scores
from services.ml.app.schemas.contracts import DriveScore, Evidence, InterviewNote, InterviewTurn


def turns() -> list[InterviewTurn]:
    return [
        InterviewTurn(
            turnId="iturn_01", speaker="interviewer", text="I helped both sides.",
            startSec=0, endSec=2,
        ),
        InterviewTurn(
            turnId="iturn_02", speaker="candidate", text="I listened first.\nThen we agreed.",
            startSec=3, endSec=7,
        ),
    ]


def note() -> InterviewNote:
    return InterviewNote(id="note_01", text="Candidate described a timeline review.")


def evidence(source: str, source_id: str, quote: str) -> Evidence:
    return Evidence(source=source, sourceId=source_id, quote=quote)


def score(*items: Evidence) -> DriveScore:
    return DriveScore(
        competency="D", score=3, confidence="medium", rationale="Observed action.",
        evidence=list(items),
    )


def test_candidate_turn_and_note_quotes_survive_verbatim() -> None:
    sources = interview_sources(turns(), [note()])
    turn_quote = evidence("interview_turn", "iturn_02", "I listened first. Then we agreed.")
    note_quote = evidence("interview_note", "note_01", "timeline review.")

    verified = verify_scores([score(turn_quote, note_quote)], sources)

    assert (verified.submitted, verified.dropped, verified.majority_dropped) == (2, 0, False)
    assert verified.scores[0].evidence == [turn_quote, note_quote]
    assert sources == {
        ("interview_turn", "iturn_02"): "I listened first.\nThen we agreed.",
        ("interview_note", "note_01"): "Candidate described a timeline review.",
    }


def test_interviewer_quote_and_wrong_source_cannot_support_score(caplog) -> None:
    sources = interview_sources(turns(), [note()])
    rejected = [
        evidence("interview_turn", "iturn_01", "I helped both sides."),
        evidence("interview_note", "iturn_02", "I listened first."),
        evidence("interview_turn", "iturn_99", "I listened first."),
        evidence("interview_turn", "iturn_02", "i listened first."),
        evidence("interview_turn", "iturn_02", "I listened first Then we agreed."),
        evidence("interview_turn", "iturn_02", "Fabricated personal fact"),
    ]
    with caplog.at_level(logging.WARNING):
        verified = verify_scores([score(*rejected)], sources)

    assert (verified.submitted, verified.dropped, verified.majority_dropped) == (6, 6, True)
    assert verified.scores[0].model_dump() == {
        "competency": "D", "score": None, "confidence": None,
        "rationale": None, "evidence": [],
    }
    assert "Fabricated personal fact" not in caplog.text
    assert "I helped both sides" not in caplog.text
    assert "iturn_01" in caplog.text


def test_exactly_half_dropped_is_not_a_retry_majority() -> None:
    sources = interview_sources(turns(), [])
    good = evidence("interview_turn", "iturn_02", "I listened first.")
    bad = evidence("interview_turn", "iturn_02", "Invented action")
    verified = verify_scores([score(good, bad)], sources)

    assert (verified.submitted, verified.dropped, verified.majority_dropped) == (2, 1, False)
    assert verified.scores[0].evidence == [good]
    assert verify_evidence([bad, bad, good], sources)[1:] == (3, 2)


@pytest.mark.parametrize("transcript,notes", [
    (turns() + [turns()[1]], []),
    (turns(), [note(), note()]),
    (turns(), [InterviewNote(id="iturn_01", text="Ambiguous id")]),
    (turns(), [InterviewNote(id="", text="Empty id")]),
])
def test_duplicate_or_ambiguous_ids_are_refused(
    transcript: list[InterviewTurn], notes: list[InterviewNote],
) -> None:
    with pytest.raises(ValueError, match="source id"):
        interview_sources(transcript, notes)
