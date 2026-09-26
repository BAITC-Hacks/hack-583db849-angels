"""S: one question about the candidate's own application, answered on camera unprepared."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import Competency, SurpriseRequest, SurpriseResult


ROOT = Path(__file__).resolve().parents[4]
PACKAGED = Path(__file__).resolve().parents[2] / "stub_data"
ROOT_PROMPT = ROOT / "config/prompts/surprise-question.md"
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED / "prompts/surprise-question.md"
ROOT_POLICY = ROOT / "config/surprise-question.json"
DEFAULT_POLICY = ROOT_POLICY if ROOT_POLICY.is_file() else PACKAGED / "surprise-question.json"


class SurpriseProposal(BaseModel):
    """The model's untrusted proposal. Every field is required: OpenAI's strict JSON mode refuses optional ones."""

    model_config = ConfigDict(extra="forbid")
    question: str
    competency: Competency
    why: str
    sourceFieldId: str


class SurprisePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int
    maxWords: int
    forbiddenTopics: list[str]


def load_surprise_policy(path: Path = DEFAULT_POLICY) -> SurprisePolicy:
    return SurprisePolicy.model_validate(json.loads(path.read_text(encoding="utf-8")))


def forbidden_topic(text: str, policy: SurprisePolicy) -> str | None:
    """The first off-limits topic the text touches, or None."""

    for pattern in policy.forbiddenTopics:
        if re.search(rf"\b(?:{pattern})\b", text, re.IGNORECASE):
            return pattern
    return None


def question_problem(proposal: SurpriseProposal, request: SurpriseRequest, policy: SurprisePolicy) -> str | None:
    """Why a proposed question cannot be asked, or None when it can. Never names the candidate's text."""

    question = proposal.question.strip()
    if not question.endswith("?") or question.count("?") != 1:
        return "not a single question"
    if len(question.split()) > policy.maxWords:
        return "too long"
    if forbidden_topic(question, policy) or forbidden_topic(proposal.why, policy):
        return "off-limits topic"
    sources = {answer.fieldId for answer in request.candidate.application.answers}
    sources |= {answer.itemId for answer in request.candidate.test.answers}
    if proposal.sourceFieldId not in sources:
        return "not about the candidate's own application"
    return None


class SurpriseGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[SurpriseProposal],
    ) -> GatewayResult[SurpriseProposal]: ...


class SurpriseQuestionWriter:
    """Writes the question through the gateway, and checks it in code before anyone sees it."""

    def __init__(
        self, gateway: SurpriseGateway, *, policy: SurprisePolicy | None = None,
        prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._policy = policy or load_surprise_policy()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("surprise question prompt is empty")

    async def write(self, request: SurpriseRequest) -> SurpriseResult:
        # The candidate's id stays out: it is the API's database id, and the
        # recorded answers must replay on any machine.
        candidate = request.candidate.model_dump(mode="json", exclude={"candidateId"})
        for attempt in (1, 2):
            result = await self._gateway.execute(GatewayRequest(
                task=TaskName.SURPRISE_QUESTION,
                prompt=self._prompt,
                payload={"candidate": candidate, "attempt": attempt},
                output_schema=SurpriseProposal,
            ))
            proposal = result.output
            if question_problem(proposal, request, self._policy) is None:
                return SurpriseResult(question=proposal.question.strip(), competency=proposal.competency, why=proposal.why.strip())
        raise GatewayOutputError("surprise question was invalid")
