"""Typed M1 brief generation through the provider-neutral ML gateway."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from ..evidence import candidate_view_sources, verify_evidence
from ..errors import ServiceError
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import (
    BriefEnglish,
    BriefQuestion,
    BriefRequest,
    BriefResult,
    BriefTopic,
    CertificateLevel,
    Claim,
    ConsistencyItem,
    Metric,
    Observation,
)
from .consistency import before_consistency


ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/m1-brief.md"
PACKAGED_PROMPT = (
    Path(__file__).resolve().parents[2] / "stub_data/prompts/m1-brief.md"
)
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT


class BriefGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[BriefResult]
    ) -> GatewayResult[BriefResult]: ...


class BriefGenerator:
    def __init__(self, gateway: BriefGateway, *, prompt_path: Path = DEFAULT_PROMPT) -> None:
        self._gateway = gateway
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("M1 brief prompt is empty")

    async def generate(self, request: BriefRequest, *, attempt: int = 1) -> BriefResult:
        result = await self._gateway.execute(
            GatewayRequest(
                task=TaskName.BRIEF,
                prompt=self._prompt,
                payload={**request.model_dump(mode="json"), "attempt": attempt},
                output_schema=BriefResult,
            )
        )
        return result.output


_OPEN_QUESTIONS = {
    "D": "Describe a time you helped someone through a setback. What did you do?",
    "R": "Describe a decision with a real risk. What alternatives did you weigh?",
    "I": "What need did your idea address, and how did you test it?",
    "V": "Describe a time fairness changed your plan. What did you choose?",
    "E": "Describe a plan you carried out. Who owned each step?",
    "invision_knowledge": "What do you know about how inVision U teaches?",
    "english": "In English, describe a recent project without preparing.",
    "motivation": "Why did you choose to apply to inVision U?",
}


class BriefService:
    def __init__(self, generator: BriefGenerator) -> None:
        self._generator = generator

    async def prepare(self, request: BriefRequest) -> BriefResult:
        try:
            sources = candidate_view_sources(request.candidate)
        except ValueError as error:
            raise ServiceError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Candidate source identifiers are ambiguous.",
            ) from error

        for attempt in (1, 2):
            proposed = await self._generator.generate(request, attempt=attempt)
            result, submitted, dropped = _ground(proposed, request, sources)
            if submitted == 0 or dropped * 2 <= submitted:
                return result
        raise GatewayOutputError("brief evidence did not match candidate sources")


def _ground(
    proposed: BriefResult,
    request: BriefRequest,
    sources: dict[tuple[str, str], str],
) -> tuple[BriefResult, int, int]:
    submitted = dropped = 0

    def checked(evidence):
        nonlocal submitted, dropped
        accepted, count, bad = verify_evidence(evidence, sources)
        submitted += count
        dropped += bad
        return accepted

    questions = []
    for item in proposed.questions:
        evidence = checked(item.evidence)
        question = _OPEN_QUESTIONS[item.focus]
        if evidence:
            first = evidence[0]
            source = "application" if first.source == "application_field" else "test"
            question = f'Your {source} response says, "{first.quote}" {question}'
        why = (
            "The cited response is worth exploring in the interview."
            if evidence else "This focus needs a direct interview example."
        )
        questions.append(BriefQuestion(
            focus=item.focus, question=question, why=why, evidence=evidence,
        ))

    clarify = []
    for item in proposed.clarify:
        evidence = checked(item.evidence)
        if evidence:
            clarify.append(BriefTopic(
                topic="Clarify the cited response and the candidate's own role.",
                evidence=evidence,
            ))

    consistency = before_consistency(request)
    for item in proposed.consistency:
        claim_evidence = checked(item.claim.evidence)
        observation_evidence = checked(item.observation.evidence)
        if item.topic == "english" or not claim_evidence:
            continue  # English is measured deterministically above.
        metric = _verified_metric(item.observation.metric, request)
        if item.observation.metric is not None and metric is None:
            continue
        if item.status != "unverified" and not observation_evidence and metric is None:
            continue
        observation_text = (
            f"The supplied simulation metric is {metric.name}: {metric.value}."
            if metric is not None else
            f"The cited test or application response is: {observation_evidence[0].quote}"
            if observation_evidence else "No comparable observation was supplied."
        )
        consistency.append(ConsistencyItem(
            itemId=f"c_{len(consistency) + 1:02d}",
            topic=item.topic,
            claim=Claim(
                text=f"The cited response says: {claim_evidence[0].quote}",
                evidence=claim_evidence,
            ),
            observation=Observation(
                text=observation_text,
                evidence=observation_evidence,
                metric=metric,
            ),
            status=item.status if observation_evidence or metric else "unverified",
            whatToDo="Ask the candidate to clarify these points with a concrete example.",
            askInInterview="How do these two points fit together in a recent example?",
        ))

    certificate = None
    supplied_certificate = request.candidate.englishCertificate
    if supplied_certificate is not None:
        suggested_level = proposed.english.certificate
        certificate = CertificateLevel(
            type=supplied_certificate.type,
            score=supplied_certificate.score,
            cefr=(
                suggested_level.cefr
                if suggested_level is not None
                and suggested_level.type == supplied_certificate.type
                and suggested_level.score == supplied_certificate.score
                else "not verified"
            ),
        )
    written = (
        proposed.english.writtenCefr
        if request.candidate.application.answers else "not assessed"
    )
    result = BriefResult(
        summary="Interview preparation based on the supplied application and test responses.",
        questions=questions,
        consistency=consistency,
        clarify=clarify,
        english=BriefEnglish(
            certificate=certificate,
            writtenCefr=written,
            basis=(
                "Estimate based on supplied written application answers; verify live."
                if request.candidate.application.answers else
                "No written application answers were supplied."
            ),
        ),
    )
    return result, submitted, dropped


def _verified_metric(metric: Metric | None, request: BriefRequest) -> Metric | None:
    if metric is None or metric.source != "simulation" or request.simulationEnglish is None:
        return None
    actual = getattr(request.simulationEnglish, metric.name)
    if actual is None or str(actual) != str(metric.value):
        return None
    return metric
