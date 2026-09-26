"""Ground M5 process signals in interviewer turns and versioned policy."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field

from ..evidence import verify_evidence
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..rubric import DriveRubric, load_drive_rubric
from ..schemas.contracts import InterviewTurn, QualityCheckRequest, QualitySignal
from .model_view import model_interview_turns


ROOT_POLICY = Path(__file__).resolve().parents[4] / "config/m5-quality-guard.json"
PACKAGED_POLICY = Path(__file__).resolve().parents[2] / "stub_data/m5-quality-guard.json"
DEFAULT_POLICY = ROOT_POLICY if ROOT_POLICY.is_file() else PACKAGED_POLICY
ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/m5-quality-guard.md"
PACKAGED_PROMPT = Path(__file__).resolve().parents[2] / "stub_data/prompts/m5-quality-guard.md"
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT
COMPETENCIES = frozenset("DRIVE")
QuestionKind = Literal["leading_question", "off_limits_question", "coverage_gap"]


class QualityPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: Literal[1]
    driftSignalAbsDelta: float = Field(gt=0, le=4, allow_inf_nan=False)
    minimumGroupObservations: int = Field(ge=1)
    forbiddenOutputWords: list[str] = Field(min_length=1)


class QuestionProposal(BaseModel):
    """Private schema for untrusted model suggestions, not a wire DTO."""

    model_config = ConfigDict(extra="forbid")
    signals: list[QualitySignal]


class QualityGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[QuestionProposal],
    ) -> GatewayResult[QuestionProposal]: ...


class InterviewQuestionAnalyzer:
    def __init__(
        self,
        gateway: QualityGateway,
        *,
        policy: QualityPolicy | None = None,
        rubric: DriveRubric | None = None,
        prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._policy = policy or load_quality_policy()
        self._rubric = rubric or load_drive_rubric()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M5 quality prompt is empty")

    async def analyze(self, request: QualityCheckRequest) -> list[QualitySignal]:
        for attempt in (1, 2):
            result = await self._gateway.execute(GatewayRequest(
                task=TaskName.QUALITY_CHECK,
                prompt=self._prompt,
                payload={
                    "mode": "interview",
                    "transcript": model_interview_turns(request.transcript),
                    "competencies": [
                        {"code": item.code.value, "name": item.name,
                         "description": item.description}
                        for item in self._rubric.competencies
                    ],
                    "attempt": attempt,
                },
                output_schema=QuestionProposal,
            ))
            grounded = ground_question_signals(
                result.output.signals, request.transcript, self._policy,
            )
            if not grounded.majority_dropped:
                return list(grounded.signals)
        raise GatewayOutputError("quality signal citations were invalid")


def load_quality_policy(path: Path = DEFAULT_POLICY) -> QualityPolicy:
    return QualityPolicy.model_validate_json(path.read_text(encoding="utf-8"))


def interviewer_sources(turns: Iterable[InterviewTurn]) -> dict[tuple[str, str], str]:
    """Index only interviewer text, rejecting ambiguous turn identifiers."""

    sources: dict[tuple[str, str], str] = {}
    seen: set[str] = set()
    for turn in turns:
        if turn.turnId in seen:
            raise ValueError("duplicate interview turn id")
        seen.add(turn.turnId)
        if turn.speaker == "interviewer":
            sources[("interview_turn", turn.turnId)] = turn.text
    return sources


def safe_process_text(value: str, policy: QualityPolicy) -> bool:
    if not value.strip():
        return False
    return not any(
        re.search(r"\b" + re.escape(word) + r"\b", value, re.IGNORECASE)
        for word in policy.forbiddenOutputWords
    )


@dataclass(frozen=True)
class GroundedSignals:
    signals: tuple[QualitySignal, ...]
    submitted: int
    dropped: int

    @property
    def majority_dropped(self) -> bool:
        return self.submitted > 0 and self.dropped * 2 > self.submitted


def ground_question_signals(
    proposed: Iterable[QualitySignal],
    turns: Iterable[InterviewTurn],
    policy: QualityPolicy,
) -> GroundedSignals:
    """Drop unsupported model claims without leaking question text to logs."""

    sources = interviewer_sources(turns)
    accepted: list[QualitySignal] = []
    submitted = 0
    dropped = 0
    for signal in proposed:
        submitted += 1
        if (
            signal.kind not in ("leading_question", "off_limits_question", "coverage_gap")
            or not safe_process_text(signal.message, policy)
            or not safe_process_text(signal.recommendation, policy)
            or any(code not in COMPETENCIES for code in signal.competencies)
        ):
            dropped += 1
            continue
        if signal.kind == "coverage_gap":
            if not signal.competencies or signal.evidence:
                dropped += 1
                continue
            accepted.append(signal)
            continue
        if signal.competencies or not signal.evidence:
            dropped += 1
            continue
        evidence, _, rejected = verify_evidence(signal.evidence, sources)
        if rejected or not evidence:
            dropped += 1
            continue
        accepted.append(signal.model_copy(update={"evidence": evidence}))
    return GroundedSignals(tuple(accepted), submitted, dropped)
