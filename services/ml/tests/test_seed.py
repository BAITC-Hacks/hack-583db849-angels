import json
from pathlib import Path
import re

from services.ml.app.schemas.contracts import (
    AssessmentResult,
    BriefResult,
    InterviewNote,
    ScoredInterview,
    Turn,
)


ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / "seed"
CANDIDATES = "abc"
EXPECTED_IDS = {
    "a": "00000000-0000-4000-8000-00000000000a",
    "b": "00000000-0000-4000-8000-00000000000b",
    "c": "00000000-0000-4000-8000-00000000000c",
}
FORBIDDEN_FEEDBACK = {"accept", "reject", "admission", "rank", "verdict", "score"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_every_candidate_has_the_complete_seed_layout_and_valid_shapes() -> None:
    for candidate in CANDIDATES:
        directory = SEED / "candidates" / candidate
        expected = {
            "snapshot.json",
            "expected-brief.json",
            "transcript.json",
            "expected-assessment.json",
            "interview-notes.json",
            "interviewer-scores.json",
        }
        assert {path.name for path in directory.iterdir()} == expected
        BriefResult.model_validate(load(directory / "expected-brief.json"))
        AssessmentResult.model_validate(load(directory / "expected-assessment.json"))
        for item in load(directory / "transcript.json"):
            Turn.model_validate(item)
        for item in load(directory / "interview-notes.json"):
            InterviewNote.model_validate(item)
        scores = load(directory / "interviewer-scores.json")
        assert scores["candidateId"] == EXPECTED_IDS[candidate]
        assert list(scores["scores"]) == list("DRIVE")


def test_assessment_evidence_is_verbatim_and_null_scores_are_not_low_scores() -> None:
    for candidate in CANDIDATES:
        directory = SEED / "candidates" / candidate
        turns = {item["turnId"]: item["text"] for item in load(directory / "transcript.json")}
        assessment = load(directory / "expected-assessment.json")
        assert [item["competency"] for item in assessment["scores"]] == list("DRIVE")
        for score in assessment["scores"]:
            if score["score"] is None:
                assert score["confidence"] is None
                assert score["rationale"] is None
                assert score["evidence"] == []
            for evidence in score["evidence"]:
                assert evidence["quote"] in turns[evidence["sourceId"]]


def test_brief_evidence_resolves_to_verbatim_snapshot_sources() -> None:
    for candidate in CANDIDATES:
        directory = SEED / "candidates" / candidate
        snapshot = load(directory / "snapshot.json")
        sources = {
            ("application_field", item["fieldId"]): item["answer"]
            for item in snapshot["application"]["answers"]
        }
        sources.update(
            {
                ("test_item", item["itemId"]): item["response"]
                for item in snapshot["test"]["answers"]
            }
        )
        brief = load(directory / "expected-brief.json")
        for question in brief["questions"]:
            for evidence in question["evidence"]:
                source = sources[(evidence["source"], evidence["sourceId"])]
                assert evidence["quote"] in source


def test_candidate_result_patterns_are_distinct() -> None:
    patterns = []
    for candidate in CANDIDATES:
        assessment = load(
            SEED / "candidates" / candidate / "expected-assessment.json"
        )
        patterns.append(tuple(item["score"] for item in assessment["scores"]))

    assert len(set(patterns)) == 3
    assert patterns[2] == (None, None, None, None, None)


def test_candidate_feedback_contains_no_numbers_or_decision_language() -> None:
    for candidate in CANDIDATES:
        assessment = load(
            SEED / "candidates" / candidate / "expected-assessment.json"
        )
        feedback = json.dumps(assessment["candidateFeedback"]).lower()
        assert re.search(r"\d", feedback) is None
        assert not any(word in feedback for word in FORBIDDEN_FEEDBACK)


def test_quality_history_is_synthetic_scored_interview_data_without_verdicts() -> None:
    history = load(SEED / "quality-history.json")
    assert len(history) >= 6
    for item in history:
        ScoredInterview.model_validate(item)
    text = json.dumps(history).lower()
    assert "synthetic" in text
    assert "verdict" not in text
    assert "candidate" not in text
