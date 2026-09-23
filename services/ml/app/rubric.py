"""Strict schema and loader for the shared D.R.I.V.E. rubric."""

from __future__ import annotations

from enum import Enum
import json
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
ROOT_RUBRIC_PATH = Path(__file__).resolve().parents[3] / "config" / "rubric.drive.json"
PACKAGED_RUBRIC_PATH = PACKAGE_ROOT / "stub_data" / "rubric.drive.json"
DEFAULT_RUBRIC_PATH = (
    ROOT_RUBRIC_PATH if ROOT_RUBRIC_PATH.is_file() else PACKAGED_RUBRIC_PATH
)


class RubricConfigurationError(ValueError):
    """The rubric is missing or does not satisfy its owned schema."""


class CompetencyCode(str, Enum):
    D = "D"
    R = "R"
    I = "I"
    V = "V"
    E = "E"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ScoringPrinciples(StrictModel):
    insufficient_evidence_score: None
    english_proficiency_affects_scores: Literal[False]
    human_decision_required: Literal[True]
    evidence_must_be_verbatim: Literal[True]


class ScoreLevel(StrictModel):
    score: Literal[0, 1, 2, 3, 4]
    label: str = Field(min_length=1)
    behavioral_indicators: list[str] = Field(min_length=1)


class EvidenceSource(StrictModel):
    source: Literal[
        "application_field",
        "test_item",
        "simulation_turn",
        "interview_note",
        "interview_turn",
        "surprise_answer",
    ]
    source_id: str = Field(min_length=1)
    text: str = Field(min_length=1)


class EvidenceExample(StrictModel):
    quote: str = Field(min_length=1)
    source: EvidenceSource
    interpretation: str = Field(min_length=1)

    @model_validator(mode="after")
    def quote_must_be_verbatim(self) -> "EvidenceExample":
        if self.quote not in self.source.text:
            raise ValueError("evidence quote must appear verbatim in source text")
        return self


class Competency(StrictModel):
    code: CompetencyCode
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    levels: list[ScoreLevel] = Field(min_length=5, max_length=5)
    insufficient_evidence_rule: str = Field(min_length=1)
    forbidden_inferences: list[str] = Field(min_length=1)
    evidence_examples: list[EvidenceExample] = Field(min_length=1)
    interview_question_templates: list[str] = Field(min_length=1)

    @field_validator("levels")
    @classmethod
    def levels_are_complete_and_ordered(
        cls, levels: list[ScoreLevel]
    ) -> list[ScoreLevel]:
        if [level.score for level in levels] != [0, 1, 2, 3, 4]:
            raise ValueError("levels must contain scores 0 through 4 in order")
        return levels


class DriveRubric(StrictModel):
    version: Literal[1]
    title: Literal["D.R.I.V.E."]
    scoring_principles: ScoringPrinciples
    competencies: Annotated[list[Competency], Field(min_length=5, max_length=5)]

    @field_validator("competencies")
    @classmethod
    def competencies_are_complete_and_ordered(
        cls, competencies: list[Competency]
    ) -> list[Competency]:
        if [item.code.value for item in competencies] != ["D", "R", "I", "V", "E"]:
            raise ValueError("competencies must appear once in D R I V E order")
        return competencies


def load_drive_rubric(path: Path = DEFAULT_RUBRIC_PATH) -> DriveRubric:
    try:
        return DriveRubric.model_validate_json(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise RubricConfigurationError(f"invalid DRIVE rubric at {path}") from error
