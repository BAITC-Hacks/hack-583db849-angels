"""FastAPI application factory for the internal ML service."""

from __future__ import annotations

import hmac

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import APIKeyHeader

from .config import Settings, load_settings
from .schemas.contracts import (
    AssessmentRequest,
    AssessmentResult,
    BriefRequest,
    BriefResult,
    HealthResponse,
    TurnRequest,
    TurnResult,
)


internal_token_header = APIKeyHeader(name="X-Internal-Token", auto_error=False)


def require_internal_token(token: str | None, expected: str | None) -> None:
    if token is None or expected is None or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Missing or unknown X-Internal-Token")


def add_contract_stub(
    app: FastAPI,
    path: str,
    request_model: type,
    response_model: type,
    dependency: object,
) -> None:
    async def stub(request: object) -> object:
        del request
        raise HTTPException(status_code=501, detail="Contract-only stub")

    stub.__name__ = path.strip("/").replace("/", "_")
    stub.__annotations__ = {"request": request_model, "return": response_model}
    app.post(path, response_model=response_model, dependencies=[Depends(dependency)])(stub)


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()
    app = FastAPI(title="AI Leader ID ML API", version="1.0.0")

    def authenticate(token: str | None = Depends(internal_token_header)) -> None:
        require_internal_token(token, resolved.ml_internal_token)

    @app.get(
        "/internal/v1/health",
        response_model=HealthResponse,
        dependencies=[Depends(authenticate)],
    )
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    add_contract_stub(
        app,
        "/internal/v1/simulation/turn",
        TurnRequest,
        TurnResult,
        authenticate,
    )
    add_contract_stub(
        app,
        "/internal/v1/simulation/assessment",
        AssessmentRequest,
        AssessmentResult,
        authenticate,
    )
    add_contract_stub(app, "/internal/v1/brief", BriefRequest, BriefResult, authenticate)
    return app


build_app = create_app
