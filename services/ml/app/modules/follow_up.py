"""L: grounded, non-leading follow-ups requested explicitly by an interviewer."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, ConfigDict

from ..evidence import candidate_view_sources, normalize_quote, verify_evidence
from ..gateway.config import TaskName
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import FollowUpRequest, FollowUpResult, FollowUpSuggestion
from .surprise import SurprisePolicy, forbidden_topic, load_surprise_policy


ROOT = Path(__file__).resolve().parents[4]
PACKAGED = Path(__file__).resolve().parents[2] / "stub_data"
ROOT_PROMPT = ROOT / "config/prompts/interview-follow-up.md"
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED / "prompts/interview-follow-up.md"
ROOT_POLICY = ROOT / "config/follow-up.json"
DEFAULT_POLICY = ROOT_POLICY if ROOT_POLICY.is_file() else PACKAGED / "follow-up.json"


class FollowUpPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    version: int
    maxWords: int
    leadingPatterns: list[str]
    judgmentWords: list[str]


def load_follow_up_policy(path: Path = DEFAULT_POLICY) -> FollowUpPolicy:
    return FollowUpPolicy.model_validate_json(path.read_text(encoding="utf-8"))


class FollowUpProposal(BaseModel):
    """Strict provider shape; semantic validation runs separately on each suggestion."""

    model_config = ConfigDict(extra="forbid")
    suggestions: list[FollowUpSuggestion]


class FollowUpGateway(Protocol):
    async def execute(self, request: GatewayRequest[FollowUpProposal]) -> GatewayResult[FollowUpProposal]: ...


def _contains(patterns: list[str], text: str) -> bool:
    return any(re.search(r"(?<!\w)(?:" + pattern + r")(?!\w)", text, re.IGNORECASE) for pattern in patterns)


def _leading(patterns: list[str], text: str) -> bool:
    return any(re.search(r"\b(?:" + pattern + r")", text, re.IGNORECASE) for pattern in patterns)


def _repeat_key(question: str) -> str:
    return " ".join(re.sub(r"[^\w\s]", " ", normalize_quote(question).casefold()).split())


def _allowed_question(question: str, policy: FollowUpPolicy) -> bool:
    clean = question.strip()
    return bool(
        clean and clean.endswith("?") and clean.count("?") == 1
        and len(clean.split()) <= policy.maxWords
        and not _leading(policy.leadingPatterns, clean)
    )


def _about_answer(question: str, why: str) -> bool:
    # Reject person-attributing language rather than a neutral "you said".
    person = r"\b(?:the candidate|applicant|you are|you're|your personality|your character|you seem|you always|you never)\b"
    return not (re.search(person, question, re.IGNORECASE) or re.search(person, why, re.IGNORECASE))


def checked_suggestions(
    proposed: list[FollowUpSuggestion], request: FollowUpRequest,
    policy: FollowUpPolicy, topics: SurprisePolicy,
) -> list[FollowUpSuggestion]:
    """Discard unsafe or ungrounded suggestions; never log supplied answer text."""

    sources = candidate_view_sources(request.candidate)
    seen_segments: set[str] = set()
    for segment in request.answer:
        if segment.segmentId in seen_segments:
            raise ValueError("duplicate follow-up segment id")
        seen_segments.add(segment.segmentId)
        sources[("follow_up_answer", segment.segmentId)] = segment.text
    previous = {_repeat_key(item.question) for item in request.plannedQuestions}
    previous.update(_repeat_key(item.question) for item in request.earlier)
    accepted: list[FollowUpSuggestion] = []
    for item in proposed:
        question = item.question.strip()
        why = item.why.strip()
        key = _repeat_key(question)
        if (
            not _allowed_question(question, policy)
            or not why or not _about_answer(question, why)
            or _contains(policy.judgmentWords, question + " " + why)
            or forbidden_topic(question, topics) or forbidden_topic(why, topics)
            or re.search(r"\b(?:grammar|grammatical|accent|pronunciation|vocabulary|fluency|english|language mistakes?)\b", question + " " + why, re.IGNORECASE)
            or key in previous
        ):
            continue
        if any(ev.source not in {"follow_up_answer", "application_field", "test_item"} for ev in item.evidence):
            continue
        evidence, _, rejected = verify_evidence(item.evidence, sources)
        kinds = {ev.source for ev in evidence}
        if rejected or "follow_up_answer" not in kinds:
            continue
        if item.reason == "mismatch":
            if not kinds.intersection({"application_field", "test_item"}):
                continue
        elif kinds != {"follow_up_answer"}:
            continue
        accepted.append(item.model_copy(update={"question": question, "why": why, "evidence": evidence}))
        previous.add(key)
        if len(accepted) == 2:
            break
    return accepted


class FollowUpWriter:
    def __init__(
        self, gateway: FollowUpGateway, *, policy: FollowUpPolicy | None = None,
        topics: SurprisePolicy | None = None, prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._policy = policy or load_follow_up_policy()
        self._topics = topics or load_surprise_policy()
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("follow-up prompt is empty")

    async def write(self, request: FollowUpRequest) -> FollowUpResult:
        candidate = request.candidate.model_dump(mode="json", exclude={"candidateId"})
        payload = request.model_dump(mode="json", exclude={"candidate"})
        payload["candidate"] = candidate
        for attempt in (1, 2):
            result = await self._gateway.execute(GatewayRequest(
                task=TaskName.INTERVIEW_FOLLOW_UP,
                prompt=self._prompt,
                payload={**payload, "attempt": attempt},
                output_schema=FollowUpProposal,
            ))
            proposed = result.output.suggestions
            valid = checked_suggestions(proposed, request, self._policy, self._topics)
            if valid or not proposed:
                return FollowUpResult(suggestions=valid)
        return FollowUpResult(suggestions=[])
