import logging

import pytest

from services.ml.app.modules.director import DirectorStateError, ScenarioDirector
from services.ml.app.modules.matcher import MatchResult
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import AnswerType, Turn, TurnRequest, TurnState


class FixedMatcher:
    def __init__(
        self,
        answer_type: AnswerType,
        *,
        similarity: float = 0.9,
        used_fallback: bool = False,
    ) -> None:
        self.answer_type = answer_type
        self.similarity = similarity
        self.used_fallback = used_fallback
        self.calls: list[tuple[str, str]] = []

    def match(self, scenario, beat_id: str, candidate_text: str) -> MatchResult:
        del scenario
        self.calls.append((beat_id, candidate_text))
        return MatchResult(
            answer_type=self.answer_type,
            similarity=self.similarity,
            used_fallback=self.used_fallback,
        )


@pytest.fixture
def scenario():
    loaded = ScenarioRepository.load(ROOT_SCENARIOS).get("conflict-resolution")
    assert loaded is not None
    return loaded


def candidate_turn(number: int = 1, text: str = "synthetic candidate response") -> Turn:
    return Turn(
        turnId=f"turn_{number:02d}",
        speaker="candidate",
        text=text,
        startedAt="2026-09-25T10:00:00Z",
        endedAt="2026-09-25T10:00:10Z",
    )


def request_for(beat_id: str, *, count: int = 1, text: str = "safe marker") -> TurnRequest:
    return TurnRequest(
        scenarioId="conflict-resolution",
        turns=[candidate_turn(index, text) for index in range(1, count + 1)],
        state=TurnState(beat=beat_id, candidateTurns=count),
    )


def test_opening_is_stateless_and_does_not_call_the_matcher(scenario) -> None:
    matcher = FixedMatcher(scenario.beats[0].fallback)
    director = ScenarioDirector(matcher)

    outcome = director.direct(
        scenario,
        TurnRequest(scenarioId=scenario.scenarioId, turns=[]),
    )

    assert outcome.stage == "opening"
    assert outcome.ended is False
    assert outcome.decision.beat == "opening"
    assert outcome.decision.nextBeat == "opening"
    assert outcome.decision.matchedAnswerType == "opening"
    assert outcome.decision.similarity is None
    assert matcher.calls == []


def test_every_configured_branch_advances_from_its_current_beat(scenario) -> None:
    for beat in scenario.beats:
        for answer_type in beat.answerTypes:
            matcher = FixedMatcher(answer_type)
            outcome = ScenarioDirector(matcher).direct(
                scenario, request_for(beat.beatId)
            )

            assert outcome.decision.beat == beat.beatId
            assert outcome.decision.matchedAnswerType == answer_type.answerTypeId
            assert outcome.decision.nextBeat == answer_type.next
            assert outcome.ended is (answer_type.next == "end")
            assert matcher.calls == [(beat.beatId, "safe marker")]


def test_fallback_and_wrapping_up_stage_are_preserved(scenario) -> None:
    decision = next(beat for beat in scenario.beats if beat.beatId == "decision")
    matcher = FixedMatcher(
        decision.fallback,
        similarity=0.12,
        used_fallback=True,
    )

    outcome = ScenarioDirector(matcher).direct(scenario, request_for("decision"))

    assert outcome.stage == "wrapping-up"
    assert outcome.ended is False
    assert outcome.decision.matchedAnswerType == "other"
    assert outcome.decision.similarity == pytest.approx(0.12)
    assert outcome.decision.nextBeat == "setback"
    assert "fallback" in outcome.decision.reason


def test_global_candidate_turn_limit_ends_before_another_beat(scenario) -> None:
    opening = next(beat for beat in scenario.beats if beat.beatId == "opening")
    matcher = FixedMatcher(opening.answerTypes[0])

    outcome = ScenarioDirector(matcher).direct(
        scenario,
        request_for("opening", count=scenario.maxCandidateTurns),
    )

    assert outcome.stage == "finished"
    assert outcome.ended is True
    assert outcome.decision.nextBeat == "end"
    assert "limit" in outcome.decision.reason


@pytest.mark.parametrize(
    "turn_request",
    [
        TurnRequest(
            scenarioId="conflict-resolution",
            turns=[],
            state=TurnState(beat="opening", candidateTurns=0),
        ),
        request_for("missing"),
        TurnRequest(
            scenarioId="conflict-resolution",
            turns=[candidate_turn()],
            state=TurnState(beat="opening", candidateTurns=2),
        ),
    ],
)
def test_invalid_stateless_position_fails_safely(scenario, turn_request) -> None:
    matcher = FixedMatcher(scenario.beats[0].fallback)

    with pytest.raises(DirectorStateError):
        ScenarioDirector(matcher).direct(scenario, turn_request)


def test_decision_log_has_metadata_but_not_candidate_text(scenario, caplog) -> None:
    marker = "NEVER_LOG_THIS_SYNTHETIC_TRANSCRIPT"
    opening = next(beat for beat in scenario.beats if beat.beatId == "opening")
    matcher = FixedMatcher(opening.answerTypes[0])

    with caplog.at_level(logging.INFO):
        ScenarioDirector(matcher).direct(
            scenario,
            request_for("opening", text=marker),
        )

    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.message == "scenario_director_decision"
    assert record.scenario_id == scenario.scenarioId
    assert record.beat_id == "opening"
    assert record.matched_answer_type == "acknowledge"
    assert marker not in caplog.text


def test_director_has_no_session_memory_between_calls(scenario) -> None:
    opening = next(beat for beat in scenario.beats if beat.beatId == "opening")
    matcher = FixedMatcher(opening.answerTypes[0])
    director = ScenarioDirector(matcher)
    request = request_for("opening")

    first = director.direct(scenario, request)
    second = director.direct(scenario, request)

    assert second == first
