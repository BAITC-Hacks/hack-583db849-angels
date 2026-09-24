import json
from pathlib import Path

import pytest

from services.ml.app.modules.assessment_text import (
    AssessmentText,
    ensure_safe_feedback,
    load_feedback_templates,
)
from services.ml.app.schemas.contracts import CandidateFeedback, DriveScore, Evidence


def scores(pattern: tuple[int | None, ...]) -> list[DriveScore]:
    result = []
    for code, value in zip("DRIVE", pattern, strict=True):
        result.append(
            DriveScore(
                competency=code, score=value,
                confidence="medium" if value is not None else None,
                rationale="Observed action." if value is not None else None,
                evidence=[
                    Evidence(source="simulation_turn", sourceId="turn_02", quote="I acted")
                ] if value is not None else [],
            )
        )
    return result


def test_each_null_competency_gets_its_own_live_question() -> None:
    questions, feedback = AssessmentText().generate(scores((None, 2, None, 4, 3)))
    assert [question.competency for question in questions] == ["D", "I"]
    assert all(question.question.endswith("?") for question in questions)
    assert all("not show enough evidence" in question.reason for question in questions)
    assert len(feedback.strengths) == 2
    assert len(feedback.growth) == 3


def test_feedback_templates_are_safe_and_developmental() -> None:
    templates = load_feedback_templates()
    questions, feedback = AssessmentText(templates=templates).generate(
        scores((3, 2, 4, 0, None))
    )
    assert len(questions) == 1
    assert len(feedback.nextTime) == 5
    assert ensure_safe_feedback(feedback) is feedback
    assert "next action" in " ".join(feedback.nextTime).lower()


@pytest.mark.parametrize("unsafe", ["Score 3", "Your rank improved", "You pass", "You were accepted", "Admission likely", "A1 level"])
def test_unsafe_candidate_feedback_is_rejected(unsafe: str) -> None:
    with pytest.raises(ValueError, match="safety policy"):
        ensure_safe_feedback(CandidateFeedback(strengths=[unsafe], growth=[], nextTime=[]))


def test_templates_cannot_hide_unsafe_word(tmp_path) -> None:
    data = json.loads(
        (Path(__file__).resolve().parents[3] / "config/m3-feedback.json").read_text(
            encoding="utf-8"
        )
    )
    data["competencies"]["D"]["growth"] = "You fail this task."
    path = tmp_path / "feedback.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="safety policy"):
        load_feedback_templates(path)
