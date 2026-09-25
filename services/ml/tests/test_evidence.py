import logging

from services.ml.app.evidence import (
    candidate_turn_sources,
    candidate_view_sources,
    normalize_quote,
    verify_evidence,
    verify_scores,
)
from services.ml.app.schemas.contracts import CandidateView, DriveScore, Evidence, Turn
import pytest


def score(*quotes: Evidence) -> DriveScore:
    return DriveScore(
        competency="D",
        score=3,
        confidence="medium",
        rationale="The response shows recovery.",
        evidence=list(quotes),
    )


def item(quote: str, source_id: str = "turn_02", source: str = "simulation_turn") -> Evidence:
    return Evidence(source=source, sourceId=source_id, quote=quote)


def turns() -> list[Turn]:
    return [
        Turn(
            turnId="turn_01", speaker="character", text="I fixed the timeline.",
            startedAt="2026-09-25T10:00:00Z", endedAt="2026-09-25T10:00:04Z",
        ),
        Turn(
            turnId="turn_02", speaker="candidate",
            text="I asked the team, then changed the timeline.\nWe agreed on owners.",
            startedAt="2026-09-25T10:00:05Z", endedAt="2026-09-25T10:00:15Z",
        ),
    ]


def test_only_spec_normalization_passes_and_verbatim_quote_is_preserved() -> None:
    source = {("simulation_turn", "turn_02"): 'I said “wait”—then we agreed.\nTogether.'}
    quote = item('“wait”—then we agreed.   Together.')
    accepted, submitted, dropped = verify_evidence([quote], source)
    assert (accepted, submitted, dropped) == ([quote], 1, 0)
    assert accepted[0].quote == quote.quote
    assert normalize_quote("I\u2019m  ready") == "I'm ready"


def test_case_punctuation_and_unknown_source_are_not_normalized() -> None:
    sources = candidate_turn_sources(turns())
    attempts = [
        item("i asked the team"),
        item("I asked the team then changed the timeline"),
        item("I fixed the timeline.", source_id="turn_01"),
        item("I asked the team", source_id="turn_99"),
        item("I asked the team", source="interview_turn"),
    ]
    assert verify_evidence(attempts, sources) == ([], 5, 5)


def test_unsupported_score_becomes_null_and_logs_no_quote(caplog) -> None:
    fabricated = item("Secret made-up candidate text")
    with caplog.at_level(logging.WARNING):
        result = verify_scores([score(fabricated)], candidate_turn_sources(turns()))
    assert (result.submitted, result.dropped, result.majority_dropped) == (1, 1, True)
    assert result.scores[0].model_dump() == {
        "competency": "D", "score": None, "confidence": None,
        "rationale": None, "evidence": [],
    }
    assert "Secret" not in caplog.text
    assert "turn_02" in caplog.text


def test_exactly_half_is_not_a_majority() -> None:
    verified = verify_scores(
        [score(item("I asked the team"), item("Invented action"))],
        candidate_turn_sources(turns()),
    )
    assert (verified.submitted, verified.dropped, verified.majority_dropped) == (
        2, 1, False,
    )
    assert verified.scores[0].score == 3
    assert [piece.quote for piece in verified.scores[0].evidence] == ["I asked the team"]


def test_candidate_view_sources_only_exposes_application_and_test() -> None:
    candidate = CandidateView.model_validate({
        "candidateId": "synthetic-a",
        "application": {"answers": [
            {"fieldId": "english_self", "question": "English?", "answer": "C2. I speak fluently."},
        ]},
        "test": {"answers": [
            {"itemId": "block_03", "response": "I decide quickly."},
        ]},
    })
    sources = candidate_view_sources(candidate)
    assert sources == {
        ("application_field", "english_self"): "C2. I speak fluently.",
        ("test_item", "block_03"): "I decide quickly.",
    }
    valid = Evidence(source="application_field", sourceId="english_self", quote="C2.")
    fabricated = Evidence(source="simulation_turn", sourceId="turn_02", quote="C2.")
    assert verify_evidence([valid, fabricated], sources) == ([valid], 2, 1)


@pytest.mark.parametrize("kind", ["application", "test"])
def test_candidate_view_sources_rejects_duplicate_ids(kind: str) -> None:
    candidate = CandidateView.model_validate({
        "candidateId": "synthetic-a",
        "application": {"answers": [
            {"fieldId": "same", "question": "First", "answer": "First answer"},
            *([{"fieldId": "same", "question": "Second", "answer": "Second answer"}]
              if kind == "application" else []),
        ]},
        "test": {"answers": [
            {"itemId": "same", "response": "First response"},
            *([{"itemId": "same", "response": "Second response"}]
              if kind == "test" else []),
        ]},
    })
    with pytest.raises(ValueError, match="duplicate"):
        candidate_view_sources(candidate)
