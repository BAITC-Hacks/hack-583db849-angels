"""End-to-end stateless simulation-turn orchestration."""

from __future__ import annotations

import logging
from time import perf_counter
from typing import Protocol, Sequence

from ..errors import ServiceError
from ..scenarios import ScenarioRepository
from ..schemas.contracts import ScenarioConfig, Turn, TurnRequest, TurnResult
from .director import DirectorOutcome, DirectorStateError, ScenarioDirector


logger = logging.getLogger("uvicorn.error")


class Actor(Protocol):
    async def generate(
        self,
        scenario: ScenarioConfig,
        outcome: DirectorOutcome,
        turns: Sequence[Turn],
    ) -> str: ...


class SimulationService:
    def __init__(
        self,
        scenarios: ScenarioRepository,
        director: ScenarioDirector,
        actor: Actor,
    ) -> None:
        self._scenarios = scenarios
        self._director = director
        self._actor = actor

    async def turn(self, request: TurnRequest) -> TurnResult:
        started = perf_counter()
        scenario = self._scenarios.get(request.scenarioId)
        if scenario is None:
            raise ServiceError(
                status_code=404,
                code="SCENARIO_NOT_FOUND",
                message="Scenario not found.",
            )

        director_started = perf_counter()
        try:
            outcome = self._director.direct(scenario, request)
        except DirectorStateError as error:
            raise ServiceError(
                status_code=422,
                code="VALIDATION_ERROR",
                message="Request validation failed.",
            ) from error
        director_ms = (perf_counter() - director_started) * 1000

        actor_started = perf_counter()
        text = await self._actor.generate(scenario, outcome, request.turns)
        actor_ms = (perf_counter() - actor_started) * 1000
        result = TurnResult(
            text=text,
            stage=outcome.stage,
            ended=outcome.ended,
            director=outcome.decision,
        )
        logger.info(
            "simulation_turn_completed",
            extra={
                "scenario_id": scenario.scenarioId,
                "beat_id": outcome.decision.beat,
                "next_beat": outcome.decision.nextBeat,
                "stage": outcome.stage,
                "ended": outcome.ended,
                "director_ms": round(director_ms, 3),
                "actor_ms": round(actor_ms, 3),
                "total_ms": round((perf_counter() - started) * 1000, 3),
            },
        )
        return result
