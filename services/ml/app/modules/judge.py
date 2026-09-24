"""Rubric-grounded M3 judging with verified candidate-turn evidence."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, field_validator

from ..evidence import candidate_turn_sources, verify_scores
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..rubric import DriveRubric, load_drive_rubric
from ..schemas.contracts import AssessmentRequest, DriveScore, all_five


ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config" / "prompts" / "m3-judge.md"
PACKAGED_PROMPT = (
    Path(__file__).resolve().parents[2] / "stub_data" / "prompts" / "m3-judge.md"
)
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT


class JudgeOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scores: list[DriveScore]

    @field_validator("scores")
    @classmethod
    def ordered_scores(cls, scores: list[DriveScore]) -> list[DriveScore]:
        return all_five(scores)


class JudgeGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[JudgeOutput]
    ) -> GatewayResult[JudgeOutput]: ...


class SimulationJudge:
    def __init__(
        self,
        gateway: JudgeGateway,
        *,
        rubric: DriveRubric | None = None,
        prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._rubric = rubric or load_drive_rubric()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M3 judge prompt is empty")

    async def judge(self, request: AssessmentRequest) -> list[DriveScore]:
        sources = candidate_turn_sources(request.turns)
        for attempt in (1, 2):
            output = await self._gateway.execute(
                GatewayRequest(
                    task=TaskName.SIMULATION_ASSESSMENT,
                    prompt=self._prompt,
                    payload={
                        "scenarioId": request.scenarioId,
                        "rubric": {
                            "scoringPrinciples": self._rubric.scoring_principles.model_dump(
                                mode="json"
                            ),
                            "competencies": [
                                {
                                    "code": item.code.value,
                                    "name": item.name,
                                    "description": item.description,
                                    "levels": [
                                        level.model_dump(mode="json")
                                        for level in item.levels
                                    ],
                                    "insufficientEvidenceRule": item.insufficient_evidence_rule,
                                    "forbiddenInferences": item.forbidden_inferences,
                                }
                                for item in self._rubric.competencies
                            ],
                        },
                        "turns": [turn.model_dump(mode="json") for turn in request.turns],
                        "attempt": attempt,
                    },
                    output_schema=JudgeOutput,
                )
            )
            verification = verify_scores(output.output.scores, sources)
            if not verification.majority_dropped:
                return list(verification.scores)
        raise GatewayOutputError("judge evidence did not match source turns")
