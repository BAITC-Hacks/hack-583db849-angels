"""Deterministic M5 timing and score comparisons; model wording is bounded."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from ..errors import ServiceError
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..rubric import DriveRubric, load_drive_rubric
from ..schemas.contracts import (
    Competency, Drift, InterviewTurn, QualityCheckRequest, QualitySignal, TalkShare,
)
from .quality_guard import DEFAULT_PROMPT, QualityPolicy, load_quality_policy, safe_process_text


_ONE_DECIMAL = Decimal("0.1")
_TWO_DECIMALS = Decimal("0.01")
_NUMBER = re.compile(r"(?<![\w])-?\d+(?:\.\d+)?")


def _rounded(value: Decimal, precision: Decimal) -> float:
    return float(value.quantize(precision, rounding=ROUND_HALF_UP))


def talk_share(turns: list[InterviewTurn]) -> TalkShare | None:
    """Use speaking durations, never word count or model inference."""

    total = {"interviewer": Decimal(0), "candidate": Decimal(0)}
    for turn in turns:
        start, end = Decimal(str(turn.startSec)), Decimal(str(turn.endSec))
        if not start.is_finite() or not end.is_finite() or end <= start:
            continue
        total[turn.speaker] += end - start
    duration = total["interviewer"] + total["candidate"]
    if duration <= 0:
        return None
    interviewer = _rounded(total["interviewer"] / duration, _TWO_DECIMALS)
    return TalkShare(interviewer=interviewer, candidate=round(1 - interviewer, 2))


def _period(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("not a calendar date")
        return date.fromisoformat(value)
    except ValueError as error:
        raise ServiceError(
            status_code=422, code="VALIDATION_ERROR", message="Invalid quality-check period.",
        ) from error


def compute_drift(request: QualityCheckRequest, policy: QualityPolicy) -> tuple[list[Drift], list[dict], int]:
    """Compare the selected interviewer with everyone else in the period."""

    start, end = _period(request.periodFrom), _period(request.periodTo)
    if start is not None and end is not None and end <= start:
        raise ServiceError(
            status_code=422, code="VALIDATION_ERROR", message="Invalid quality-check period.",
        )
    values: dict[str, dict[str, list[int]]] = {
        code: {"target": [], "panel": []} for code in "DRIVE"
    }
    count = 0
    seen_interviews: set[str] = set()
    for item in request.history:
        if item.interviewRef in seen_interviews:
            raise ServiceError(
                status_code=422, code="VALIDATION_ERROR", message="Duplicate interview reference.",
            )
        seen_interviews.add(item.interviewRef)
        try:
            held_at = datetime.fromisoformat(item.heldAt.replace("Z", "+00:00"))
            if held_at.tzinfo is None:
                raise ValueError("timestamp has no timezone")
            day = held_at.astimezone(timezone.utc).date()
        except ValueError as error:
            raise ServiceError(
                status_code=422, code="VALIDATION_ERROR", message="Invalid interview timestamp.",
            ) from error
        if (start is not None and day < start) or (end is not None and day >= end):
            continue
        count += 1
        group = "target" if item.interviewerRef == request.interviewerRef else "panel"
        seen_codes: set[str] = set()
        for score in item.scores:
            if score.competency in seen_codes:
                raise ServiceError(
                    status_code=422, code="VALIDATION_ERROR", message="Duplicate competency score.",
                )
            seen_codes.add(score.competency)
            if score.score is not None:
                values[score.competency][group].append(score.score)
    rows: list[Drift] = []
    selected: list[dict] = []
    for code in "DRIVE":
        target, panel = values[code]["target"], values[code]["panel"]
        if not target or not panel:
            continue
        target_mean = _rounded(Decimal(sum(target)) / len(target), _ONE_DECIMAL)
        panel_mean = _rounded(Decimal(sum(panel)) / len(panel), _ONE_DECIMAL)
        delta = _rounded(Decimal(str(target_mean)) - Decimal(str(panel_mean)), _ONE_DECIMAL)
        row = Drift(competency=code, interviewerMean=target_mean, panelMean=panel_mean, delta=delta)
        rows.append(row)
        if (
            len(target) >= policy.minimumGroupObservations
            and len(panel) >= policy.minimumGroupObservations
            and abs(delta) >= policy.driftSignalAbsDelta
        ):
            selected.append({
                "competency": code, "interviewerMean": target_mean,
                "panelMean": panel_mean, "delta": delta,
                "interviewerInterviews": len(target), "panelInterviews": len(panel),
            })
    return rows, selected, count


class CalibrationText(BaseModel):
    model_config = ConfigDict(extra="forbid")

    competency: Competency
    message: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)


class CalibrationProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    signals: list[CalibrationText]


class CalibrationGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[CalibrationProposal],
    ) -> GatewayResult[CalibrationProposal]: ...


class CalibrationWording:
    def __init__(
        self, gateway: CalibrationGateway, *, policy: QualityPolicy | None = None,
        rubric: DriveRubric | None = None, prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._policy = policy or load_quality_policy()
        self._rubric = rubric or load_drive_rubric()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M5 quality prompt is empty")

    async def write(self, selected: list[dict]) -> list[QualitySignal]:
        if not selected:
            return []
        names = {item.code.value: item.name for item in self._rubric.competencies}
        permitted = {item["competency"] for item in selected}
        for attempt in (1, 2):
            result = await self._gateway.execute(GatewayRequest(
                task=TaskName.QUALITY_CHECK,
                prompt=self._prompt,
                payload={
                    "mode": "calibration",
                    "drift": [{**item, "name": names[item["competency"]]} for item in selected],
                    "attempt": attempt,
                },
                output_schema=CalibrationProposal,
            ))
            proposed = result.output.signals
            if len(proposed) != len(selected) or {item.competency for item in proposed} != permitted:
                continue
            by_code = {item.competency: item for item in proposed}
            if len(by_code) != len(proposed):
                continue
            accepted: list[QualitySignal] = []
            for item in selected:
                text = by_code[item["competency"]]
                if not (
                    safe_process_text(text.message, self._policy)
                    and safe_process_text(text.recommendation, self._policy)
                    and _numbers_match(text.message + " " + text.recommendation, item)
                ):
                    break
                accepted.append(QualitySignal(
                    kind="scale_drift", message=text.message,
                    recommendation=text.recommendation,
                    competencies=[item["competency"]], evidence=[],
                ))
            if len(accepted) == len(selected):
                return accepted
        raise GatewayOutputError("calibration wording was invalid")


def _numbers_match(text: str, facts: dict) -> bool:
    allowed = {
        Decimal(str(facts[key])) for key in (
            "interviewerMean", "panelMean", "delta", "interviewerInterviews", "panelInterviews",
        )
    }
    return all(Decimal(value) in allowed for value in _NUMBER.findall(text))
