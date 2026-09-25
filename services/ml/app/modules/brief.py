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
)
from .consistency import assemble_before_consistency
from .model_view import model_brief_request


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
                payload={**model_brief_request(request), "attempt": attempt},
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
    "motivation": (
        "What in the programme supports your goals, and how did its free tuition "
        "factor into your decision to apply?"
    ),
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
        if item.focus == "motivation":
            why = (
                "Explore programme fit and the role of cost without assuming either "
                "is the candidate's only reason."
            )
        else:
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

    consistency = assemble_before_consistency(request, proposed.consistency, checked)

    certificate = None
    supplied_certificate = request.candidate.englishCertificate
    if supplied_certificate is not None:
        certificate = CertificateLevel(
            type=supplied_certificate.type,
            score=supplied_certificate.score,
            cefr="not verified",
        )
    result = BriefResult(
        summary="Interview preparation based on the supplied application and test responses.",
        questions=questions,
        consistency=consistency,
        clarify=clarify,
        english=BriefEnglish(
            certificate=certificate,
            writtenCefr="not assessed",
            basis="Written English is not independently measured; verify live.",
        ),
    )
    return result, submitted, dropped
