"""Generate one application-grounded surprise question without profile data."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from ..evidence import normalize_quote
from ..errors import ServiceError
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import Competency, SurpriseRequest, SurpriseResult


ROOT_PROMPT = Path(__file__).resolve().parents[4] / "config/prompts/surprise-question.md"
PACKAGED_PROMPT = Path(__file__).resolve().parents[2] / "stub_data/prompts/surprise-question.md"
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT
_WORDS = re.compile(r"[A-Za-z]+")
_STOPWORDS = frozenset({
    "about", "after", "again", "before", "could", "every", "from", "have",
    "into", "other", "their", "there", "these", "those", "through", "were",
    "what", "when", "where", "which", "while", "with", "would", "your",
})
_FORBIDDEN = re.compile(
    r"\b(?:personal\s+life|family|families|parent|parents|mother|father|"
    r"sibling|siblings|health|medical|illness|disability|mental|money|income|"
    r"salary|financial|finances|tuition|funding|religion|ethnicity|gender|"
    r"birthday|birthplace|hometown|region|school|address|phone|email|iin|"
    r"photo|appearance|married|marriage|admission|admit|accept|reject|rank|"
    r"score|grade)\b",
    re.IGNORECASE,
)
_CONTACT = re.compile(r"(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\b\d{7,}\b)")


class SurpriseProposal(BaseModel):
    """Private model output; source fields never enter the wire response."""

    model_config = ConfigDict(extra="forbid")

    question: str
    competency: Competency
    why: str
    fieldId: str
    sourceQuote: str


class SurpriseGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[SurpriseProposal]
    ) -> GatewayResult[SurpriseProposal]: ...


class SurpriseQuestionService:
    def __init__(
        self, gateway: SurpriseGateway, *, prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("surprise-question prompt is empty")

    async def prepare(self, request: SurpriseRequest) -> SurpriseResult:
        answers = request.candidate.application.answers
        sources: dict[str, str] = {}
        for answer in answers:
            if not answer.fieldId or answer.fieldId in sources:
                raise ServiceError(
                    status_code=422, code="VALIDATION_ERROR",
                    message="Application source identifiers are invalid.",
                )
            sources[answer.fieldId] = answer.answer
        if not sources:
            raise ServiceError(
                status_code=422, code="VALIDATION_ERROR",
                message="Application answers are required.",
            )

        application = [
            {"fieldId": item.fieldId, "question": item.question, "answer": item.answer}
            for item in answers
        ]
        for attempt in (1, 2):
            response = await self._gateway.execute(GatewayRequest(
                task=TaskName.SURPRISE_QUESTION,
                prompt=self._prompt,
                payload={"application": application, "attempt": attempt},
                output_schema=SurpriseProposal,
            ))
            proposed = response.output
            if safe_surprise_proposal(proposed, sources):
                return SurpriseResult(
                    question=proposed.question.strip(),
                    competency=proposed.competency,
                    why=proposed.why.strip(),
                )
        raise GatewayOutputError("surprise-question output was invalid")


def safe_surprise_proposal(proposed: SurpriseProposal, sources: dict[str, str]) -> bool:
    """Verify a real source anchor and reject unsafe or generic output."""

    question = proposed.question.strip()
    why = proposed.why.strip()
    quote = proposed.sourceQuote.strip()
    source = sources.get(proposed.fieldId)
    if not source or not quote or normalize_quote(quote) not in normalize_quote(source):
        return False
    if not question or not why or len(question.split()) > 40:
        return False
    if question.count("?") != 1 or "\n" in question:
        return False
    if any("[redacted]" in value.lower() for value in (question, why, quote)):
        return False
    if any(_FORBIDDEN.search(value) or _CONTACT.search(value) for value in (question, why)):
        return False
    anchor = {
        token.lower() for token in _WORDS.findall(quote)
        if len(token) >= 4 and token.lower() not in _STOPWORDS
    }
    question_tokens = {token.lower() for token in _WORDS.findall(question)}
    return len(anchor) >= 2 and len(anchor & question_tokens) >= 2
