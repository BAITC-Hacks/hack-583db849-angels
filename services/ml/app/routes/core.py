"""Candidate-A F0 stubs for the first internal ML operations."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends

from ..errors import ServiceError
from ..examples import load_example
from ..modules.simulation import SimulationService
from ..scenarios import ScenarioRepository
from ..schemas.contracts import (
    AssessmentRequest,
    AssessmentResult,
    BriefRequest,
    BriefResult,
    ScenarioBrief,
    TurnRequest,
    TurnResult,
)


def core_router(
    authenticate: Callable[..., None],
    scenarios_repository: ScenarioRepository,
    simulation_service: SimulationService,
) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.get("/scenarios", response_model=list[ScenarioBrief])
    async def scenarios() -> list[ScenarioBrief]:
        return list(scenarios_repository.briefs())

    @router.get("/scenarios/{scenarioId}", response_model=ScenarioBrief)
    async def scenario(scenarioId: str) -> ScenarioBrief:
        item = scenarios_repository.brief(scenarioId)
        if item is not None:
            return item
        raise ServiceError(
            status_code=404,
            code="SCENARIO_NOT_FOUND",
            message="Scenario not found.",
        )

    @router.post("/simulation/turn", response_model=TurnResult)
    async def simulation_turn(request: TurnRequest) -> TurnResult:
        return await simulation_service.turn(request)

    @router.post("/simulation/assessment", response_model=AssessmentResult)
    async def simulation_assessment(request: AssessmentRequest) -> AssessmentResult:
        del request
        return load_example("simulation-assessment.response.json", AssessmentResult)

    @router.post("/brief", response_model=BriefResult)
    async def brief(request: BriefRequest) -> BriefResult:
        del request
        return load_example("brief.response.json", BriefResult)

    return router
