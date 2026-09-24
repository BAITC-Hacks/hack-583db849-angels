"""Human follow-ups and safe developmental candidate text from verified scores."""

from __future__ import annotations

from pathlib import Path
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..rubric import DriveRubric, load_drive_rubric
from ..schemas.contracts import CandidateFeedback, DriveScore, InterviewQuestion, all_five


ROOT_TEMPLATES = Path(__file__).resolve().parents[4] / "config" / "m3-feedback.json"
PACKAGED_TEMPLATES = (
    Path(__file__).resolve().parents[2] / "stub_data" / "m3-feedback.json"
)
DEFAULT_TEMPLATES = (
    ROOT_TEMPLATES if ROOT_TEMPLATES.is_file() else PACKAGED_TEMPLATES
)
_FORBIDDEN = re.compile(
    r"\b(?:score|scores|scoring|rank|ranking|admit|admitted|admission|"
    r"reject|rejected|accept|accepted|pass|passed|fail|failed|grade|"
    r"grades|verdict|selected|selection|points?)\b",
    re.IGNORECASE,
)


def ensure_safe_feedback(feedback: CandidateFeedback) -> CandidateFeedback:
    for line in (*feedback.strengths, *feedback.growth, *feedback.nextTime):
        if not line.strip() or any(char.isdigit() for char in line) or _FORBIDDEN.search(line):
            raise ValueError("candidate feedback violates the safety policy")
    return feedback


class FeedbackEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    strength: str = Field(min_length=1)
    growth: str = Field(min_length=1)
    nextTime: str = Field(min_length=1)


class FeedbackTemplates(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: int = Field(ge=1, le=1)
    competencies: dict[str, FeedbackEntry]

    @field_validator("competencies")
    @classmethod
    def all_competencies(cls, entries: dict[str, FeedbackEntry]) -> dict[str, FeedbackEntry]:
        if set(entries) != set("DRIVE"):
            raise ValueError("feedback templates require D R I V E")
        ensure_safe_feedback(
            CandidateFeedback(
                strengths=[entry.strength for entry in entries.values()],
                growth=[entry.growth for entry in entries.values()],
                nextTime=[entry.nextTime for entry in entries.values()],
            )
        )
        return entries


def load_feedback_templates(path: Path = DEFAULT_TEMPLATES) -> FeedbackTemplates:
    return FeedbackTemplates.model_validate_json(path.read_text(encoding="utf-8"))


class AssessmentText:
    def __init__(
        self,
        *,
        rubric: DriveRubric | None = None,
        templates: FeedbackTemplates | None = None,
    ) -> None:
        self._rubric = rubric or load_drive_rubric()
        self._templates = templates or load_feedback_templates()

    def generate(
        self, scores: list[DriveScore]
    ) -> tuple[list[InterviewQuestion], CandidateFeedback]:
        all_five(scores)
        questions = []
        strengths = []
        growth = []
        next_time = []
        for score, competency in zip(scores, self._rubric.competencies, strict=True):
            entry = self._templates.competencies[score.competency]
            if score.score is None:
                questions.append(
                    InterviewQuestion(
                        competency=score.competency,
                        question=competency.interview_question_templates[0],
                        reason=f"The role-play did not show enough evidence for {competency.name}.",
                    )
                )
            if score.score is not None and score.score >= 3:
                strengths.append(entry.strength)
            else:
                growth.append(entry.growth)
            next_time.append(entry.nextTime)
        feedback = ensure_safe_feedback(
            CandidateFeedback(strengths=strengths, growth=growth, nextTime=next_time)
        )
        return questions, feedback
