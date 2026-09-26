"""Internal consistency, draft, quality, and remaining demo JSON operations."""

from __future__ import annotations

from collections.abc import Callable
from decimal import Decimal

from fastapi import APIRouter, Depends

from ..config import GatewayMode
from ..gateway.usage import FileUsageStore
from ..modules.interview_draft import InterviewDraftService
from ..modules.consistency import ConsistencyService
from ..modules.quality_check import QualityCheckService
from ..modules.surprise import SurpriseQuestionWriter
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
from .usage import usage_summary


def extended_router(
    authenticate: Callable[..., None],
    usage_store: FileUsageStore,
    gateway_mode: GatewayMode,
    cap_usd: Decimal,
    draft_service: InterviewDraftService,
    consistency_service: ConsistencyService,
    quality_service: QualityCheckService,
    surprise_writer: SurpriseQuestionWriter,
) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(authenticate)])

    @router.post("/consistency", response_model=ConsistencyResult)
    async def consistency(request: ConsistencyRequest) -> ConsistencyResult:
        return await consistency_service.prepare(request)

    @router.post("/surprise-question", response_model=SurpriseResult)
    async def surprise_question(request: SurpriseRequest) -> SurpriseResult:
        return await surprise_writer.write(request)

    @router.get("/usage", response_model=Usage)
    async def usage() -> Usage:
        return await usage_summary(usage_store, gateway_mode, cap_usd)

    @router.post("/interview/draft", response_model=DraftResult)
    async def interview_draft(request: DraftRequest) -> DraftResult:
        return await draft_service.prepare(request)

    @router.post("/quality-check", response_model=QualityCheckResult)
    async def quality_check(request: QualityCheckRequest) -> QualityCheckResult:
        return await quality_service.prepare(request)

    return router
