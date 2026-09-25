"""Blind M4 draft generation using the rubric and validated interview input."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..gateway.config import TaskName
from ..gateway.types import GatewayRequest, GatewayResult
from ..rubric import DriveRubric, load_drive_rubric
from ..schemas.contracts import DraftRequest, DraftResult


ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/m4-interview-draft.md"
PACKAGED_PROMPT = (
    Path(__file__).resolve().parents[2] / "stub_data/prompts/m4-interview-draft.md"
)
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT


class DraftGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[DraftResult]
    ) -> GatewayResult[DraftResult]: ...


class InterviewDraftGenerator:
    def __init__(
        self,
        gateway: DraftGateway,
        *,
        rubric: DriveRubric | None = None,
        prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._rubric = rubric or load_drive_rubric()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M4 draft prompt is empty")

    async def generate(self, request: DraftRequest, *, attempt: int = 1) -> DraftResult:
        result = await self._gateway.execute(
            GatewayRequest(
                task=TaskName.INTERVIEW_DRAFT,
                prompt=self._prompt,
                payload={
                    "rubric": {
                        "scoringPrinciples": self._rubric.scoring_principles.model_dump(mode="json"),
                        "competencies": [
                            {
                                "code": item.code.value,
                                "name": item.name,
                                "description": item.description,
                                "levels": [level.model_dump(mode="json") for level in item.levels],
                                "insufficientEvidenceRule": item.insufficient_evidence_rule,
                                "forbiddenInferences": item.forbidden_inferences,
                            }
                            for item in self._rubric.competencies
                        ],
                    },
                    "transcript": [turn.model_dump(mode="json") for turn in request.transcript],
                    "notes": [note.model_dump(mode="json") for note in request.notes],
                    "attempt": attempt,
                },
                output_schema=DraftResult,
            )
        )
        return result.output
