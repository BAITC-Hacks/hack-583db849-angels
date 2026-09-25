"""Evidence-grounded consistency signals shared by M1 and later stages."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from pathlib import Path
from typing import Protocol

from ..evidence import candidate_view_sources, verify_evidence
from ..gateway.config import TaskName
from ..gateway.types import GatewayRequest, GatewayResult
from ..metrics.certificate import mapped_certificate_cefr
from ..schemas.contracts import (
    BriefRequest,
    BriefResult,
    Claim,
    ConsistencyItem,
    ConsistencyRequest,
    ConsistencyResult,
    Evidence,
    Metric,
    Observation,
)
from .model_view import model_interview_turns, model_turns


_CEFR = re.compile(r"\b(?:A1|A2|B1|B2|C1|C2)\b", re.IGNORECASE)
ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/c-consistency.md"
PACKAGED_PROMPT = Path(__file__).resolve().parents[2] / "stub_data/prompts/c-consistency.md"
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT


class ConsistencyGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[ConsistencyResult]
    ) -> GatewayResult[ConsistencyResult]: ...


class ConsistencyGenerator:
    def __init__(
        self, gateway: ConsistencyGateway, *, prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("consistency prompt is empty")

    async def generate(
        self, request: ConsistencyRequest, before_items: list[ConsistencyItem],
        *, attempt: int = 1,
    ) -> ConsistencyResult:
        result = await self._gateway.execute(GatewayRequest(
            task=TaskName.CONSISTENCY,
            prompt=self._prompt,
            payload={
                "candidate": request.candidate.model_dump(mode="json", exclude={"candidateId"}),
                "simulationEnglish": (
                    request.simulationEnglish.model_dump(mode="json")
                    if request.simulationEnglish is not None else None
                ),
                "simulationTurns": model_turns(request.simulationTurns),
                "interviewTranscript": model_interview_turns(request.interviewTranscript),
                "beforeItems": [item.model_dump(mode="json") for item in before_items],
                "attempt": attempt,
            },
            output_schema=ConsistencyResult,
        ))
        return result.output


class BeforeBrief(Protocol):
    async def prepare(self, request: BriefRequest) -> BriefResult: ...


class ConsistencyService:
    """Before and empty-after share the M1 brief; after revisits saved items."""

    def __init__(self, generator: ConsistencyGenerator, brief: BeforeBrief) -> None:
        self._generator = generator
        self._brief = brief

    async def prepare(self, request: ConsistencyRequest) -> ConsistencyResult:
        if request.stage == "before" or not request.beforeItems:
            brief = await self._brief.prepare(BriefRequest(
                candidate=request.candidate,
                simulationEnglish=request.simulationEnglish,
            ))
            if request.stage == "before":
                return ConsistencyResult(items=brief.consistency)
            before_items = brief.consistency
        else:
            before_items = request.beforeItems
        proposed = await self._generator.generate(request, before_items)
        return reconcile_after_items(before_items, proposed)


def english_claim(request: BriefRequest) -> tuple[str, Evidence] | None:
    """Return an explicit self-rating, never infer one from writing style."""

    for answer in request.candidate.application.answers:
        if (
            "english" not in answer.fieldId.lower()
            and "english" not in answer.question.lower()
        ):
            continue
        matches = list(_CEFR.finditer(answer.answer))
        levels = {match.group().upper() for match in matches}
        if len(levels) != 1:
            return None
        match = matches[0]
        evidence = Evidence(
            source="application_field",
            sourceId=answer.fieldId,
            quote=match.group(),
        )
        if verify_evidence([evidence], candidate_view_sources(request.candidate))[0]:
            return match.group().upper(), evidence
    return None


def before_consistency(request: BriefRequest) -> list[ConsistencyItem]:
    """Compare an explicit English self-rating with supplied simulation metrics."""

    claim = english_claim(request)
    if claim is None:
        return []
    level, quote = claim
    measured = request.simulationEnglish.cefrEstimate if request.simulationEnglish else None
    metric = (
        Metric(name="cefrEstimate", value=measured, source="simulation")
        if measured is not None
        else None
    )
    status = (
        "unverified" if metric is None
        else "consistent" if level == measured.upper()
        else "discrepancy"
    )
    observation = (
        f"Simulation English was estimated at {measured}."
        if measured is not None
        else "No simulation English estimate is available yet."
    )
    certificate = request.candidate.englishCertificate
    if certificate is not None:
        mapped = mapped_certificate_cefr(certificate.type, certificate.score)
        if mapped is not None:
            observation += (
                f" The supplied IELTS overall band indicatively maps to {mapped}; "
                "the certificate has not been verified."
            )
    question = "In English, describe a recent project and an unexpected problem you solved."
    return [
        ConsistencyItem(
            itemId="c_01",
            topic="english",
            claim=Claim(text=f"Self-rated English as {level}.", evidence=[quote]),
            observation=Observation(text=observation, evidence=[], metric=metric),
            status=status,
            whatToDo="Ask an unprepared English question and review the evidence together.",
            askInInterview=question,
        )
    ]


def assemble_before_consistency(
    request: BriefRequest,
    proposed: Iterable[ConsistencyItem],
    checked: Callable[[Iterable[Evidence]], list[Evidence]],
) -> list[ConsistencyItem]:
    """Assemble the same grounded before items for M1 and standalone C."""

    items = before_consistency(request)
    for proposed_item in proposed:
        claim_evidence = checked(proposed_item.claim.evidence)
        observation_evidence = checked(proposed_item.observation.evidence)
        if proposed_item.topic == "english" or not claim_evidence:
            continue  # English is measured deterministically above.
        if proposed_item.observation.metric is not None:
            # A model may not invent a measurement for another topic.
            continue
        observation_text = (
            f"The cited test or application response is: {observation_evidence[0].quote}"
            if observation_evidence else "No comparable observation was supplied."
        )
        items.append(ConsistencyItem(
            itemId=f"c_{len(items) + 1:02d}",
            topic=proposed_item.topic,
            claim=Claim(
                text=f"The cited response says: {claim_evidence[0].quote}",
                evidence=claim_evidence,
            ),
            observation=Observation(
                text=observation_text,
                evidence=observation_evidence,
                metric=None,
            ),
            # Verified quotes establish source text, not semantic agreement.
            status="unverified",
            whatToDo="Ask the candidate to clarify these points with a concrete example.",
            askInInterview="How do these two points fit together in a recent example?",
        ))
    return items


_AFTER_STATUSES = {"confirmed", "resolved", "discrepancy", "unverified"}
_ITEM_ID = re.compile(r"^c_(\d{2,})$")


def _after_status(original: ConsistencyItem, proposed: ConsistencyItem) -> str:
    """A changed conclusion needs a new candidate observation or supplied metric."""

    if proposed.status not in {"confirmed", "resolved"}:
        return proposed.status
    has_candidate_observation = any(
        evidence.source == "interview_turn"
        for evidence in proposed.observation.evidence
    )
    has_supplied_english_measurement = (
        original.topic == "english"
        and proposed.observation.metric is not None
        and proposed.observation.metric.name == "cefrEstimate"
        and proposed.observation.metric.source == "simulation"
    )
    if not has_candidate_observation and not has_supplied_english_measurement:
        return original.status if original.status in _AFTER_STATUSES else "unverified"
    return proposed.status


def reconcile_after_items(
    before_items: list[ConsistencyItem],
    proposed: ConsistencyResult,
) -> ConsistencyResult:
    """Apply model observations without letting it rewrite saved brief claims."""

    original_ids = [item.itemId for item in before_items]
    if len(original_ids) != len(set(original_ids)) or any(
        _ITEM_ID.fullmatch(item_id) is None for item_id in original_ids
    ):
        raise ValueError("saved before item ids are ambiguous")

    proposals: dict[str, ConsistencyItem] = {}
    new_items: list[ConsistencyItem] = []
    for item in proposed.items:
        if item.itemId in proposals:
            raise ValueError("duplicate consistency proposal id")
        if item.status not in _AFTER_STATUSES:
            raise ValueError("invalid after-stage consistency status")
        proposals[item.itemId] = item
        if item.itemId not in original_ids:
            new_items.append(item)
    if any(item_id not in proposals for item_id in original_ids):
        raise ValueError("model omitted a saved before item")

    reconciled = [
        original.model_copy(update={
            "observation": proposals[original.itemId].observation,
            "status": _after_status(original, proposals[original.itemId]),
            "whatToDo": proposals[original.itemId].whatToDo,
            "askInInterview": None,
        })
        for original in before_items
    ]
    next_id = max((int(_ITEM_ID.fullmatch(item_id).group(1)) for item_id in original_ids), default=0) + 1
    for item in new_items:
        reconciled.append(item.model_copy(update={
            "itemId": f"c_{next_id:02d}",
            "askInInterview": None,
        }))
        next_id += 1
    return ConsistencyResult(items=reconciled)
