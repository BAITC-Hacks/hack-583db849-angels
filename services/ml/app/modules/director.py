"""Stateless scenario director: match one candidate turn and advance the story."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Literal, Protocol

from ..schemas.contracts import (
    Beat,
    DirectorDecision,
    ScenarioConfig,
    TurnRequest,
)
from .matcher import MatchResult


logger = logging.getLogger("uvicorn.error")
Stage = Literal["opening", "in-progress", "wrapping-up", "finished"]


class Matcher(Protocol):
    def match(
        self, scenario: ScenarioConfig, beat_id: str, candidate_text: str
    ) -> MatchResult: ...


class DirectorStateError(ValueError):
    """The supplied stateless story position cannot be used safely."""


@dataclass(frozen=True)
class DirectorOutcome:
    stage: Stage
    ended: bool
    decision: DirectorDecision
    character_intent: str


class ScenarioDirector:
    def __init__(self, matcher: Matcher) -> None:
        self._matcher = matcher

    def direct(
        self, scenario: ScenarioConfig, request: TurnRequest
    ) -> DirectorOutcome:
        if not request.turns:
            if request.state is not None:
                raise DirectorStateError("an opening request cannot contain state")
            opening = _beat(scenario, "opening")
            outcome = DirectorOutcome(
                stage="opening",
                ended=False,
                decision=DirectorDecision(
                    beat=opening.beatId,
                    matchedAnswerType="opening",
                    similarity=None,
                    nextBeat=opening.beatId,
                    reason="The scenario starts at its opening beat.",
                ),
                character_intent=opening.goal,
            )
            _log_decision(scenario, outcome, candidate_turns=0)
            return outcome

        candidate_turns = [
            turn for turn in request.turns if turn.speaker == "candidate"
        ]
        if not candidate_turns or request.state is None:
            raise DirectorStateError("a candidate turn and state are required")
        if request.turns[-1].speaker != "candidate":
            raise DirectorStateError("the latest turn must belong to the candidate")
        if request.state.candidateTurns != len(candidate_turns):
            raise DirectorStateError("candidate turn count does not match transcript")
        if request.state.candidateTurns < 1:
            raise DirectorStateError("candidate turn count must be positive")

        beat = _beat(scenario, request.state.beat)
        match = self._matcher.match(scenario, beat.beatId, candidate_turns[-1].text)
        reached_global_limit = (
            request.state.candidateTurns >= scenario.maxCandidateTurns
        )
        ended = reached_global_limit or match.answer_type.next == "end"
        next_beat = "end" if ended else match.answer_type.next
        if reached_global_limit:
            reason = "The scenario candidate-turn limit was reached."
        elif match.used_fallback:
            reason = "Similarity was below threshold; the configured fallback advanced the story."
        else:
            reason = "The closest current-beat answer type advanced the story."

        outcome = DirectorOutcome(
            stage=_stage(scenario, next_beat, ended),
            ended=ended,
            decision=DirectorDecision(
                beat=beat.beatId,
                matchedAnswerType=match.answer_type.answerTypeId,
                similarity=match.similarity,
                nextBeat=next_beat,
                reason=reason,
            ),
            character_intent=match.answer_type.characterIntent,
        )
        _log_decision(
            scenario,
            outcome,
            candidate_turns=request.state.candidateTurns,
        )
        return outcome


def _beat(scenario: ScenarioConfig, beat_id: str) -> Beat:
    for beat in scenario.beats:
        if beat.beatId == beat_id:
            return beat
    raise DirectorStateError("state references an unknown scenario beat")


def _stage(scenario: ScenarioConfig, next_beat: str, ended: bool) -> Stage:
    if ended:
        return "finished"
    following = _beat(scenario, next_beat)
    targets = {
        answer.next for answer in (*following.answerTypes, following.fallback)
    }
    return "wrapping-up" if targets == {"end"} else "in-progress"


def _log_decision(
    scenario: ScenarioConfig,
    outcome: DirectorOutcome,
    *,
    candidate_turns: int,
) -> None:
    logger.info(
        "scenario_director_decision",
        extra={
            "scenario_id": scenario.scenarioId,
            "stage": outcome.stage,
            "ended": outcome.ended,
            "beat_id": outcome.decision.beat,
            "matched_answer_type": outcome.decision.matchedAnswerType,
            "similarity": outcome.decision.similarity,
            "next_beat": outcome.decision.nextBeat,
            "candidate_turns": candidate_turns,
        },
    )
