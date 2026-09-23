"""Candidate-A F0 stubs for later-slice JSON operations."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends

from ..examples import load_example
from ..schemas.contracts import (
    ConsistencyRequest,
    ConsistencyResult,
    DraftRequest,
    DraftResult,
    QualityCheckRequest,
    QualityCheckResult,
    SurpriseRequest,
    SurpriseResult,
    Usage,
)


def extended_router(authenticate: Callable[..., None]) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.post("/consistency", response_model=ConsistencyResult)
    async def consistency(request: ConsistencyRequest) -> ConsistencyResult:
        filename = f"consistency-{request.stage}.response.json"
        return load_example(filename, ConsistencyResult)

    @router.post("/surprise-question", response_model=SurpriseResult)
    async def surprise_question(request: SurpriseRequest) -> SurpriseResult:
        del request
        return load_example("surprise-question.response.json", SurpriseResult)

    @router.get("/usage", response_model=Usage)
    async def usage() -> Usage:
        return load_example("usage.response.json", Usage)

    @router.post("/interview/draft", response_model=DraftResult)
    async def interview_draft(request: DraftRequest) -> DraftResult:
        del request
        return load_example("interview-draft.response.json", DraftResult)

    @router.post("/quality-check", response_model=QualityCheckResult)
    async def quality_check(request: QualityCheckRequest) -> QualityCheckResult:
        filename = f"quality-check-{request.kind}.response.json"
        return load_example(filename, QualityCheckResult)

    return router
