"""FastAPI application factory for the internal ML service."""

from __future__ import annotations

from fastapi import FastAPI

from .auth import internal_auth_dependency
from .config import Settings, load_settings
from .errors import install_error_handlers
from .routes.core import core_router
from .routes.extended import extended_router
from .schemas.contracts import HealthResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()
    app = FastAPI(title="AI Leader ID ML API", version="1.0.0")
    install_error_handlers(app)
    authenticate = internal_auth_dependency(resolved.ml_internal_token)

    @app.get(
        "/internal/v1/health",
        response_model=HealthResponse,
    )
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    app.include_router(core_router(authenticate))
    app.include_router(extended_router(authenticate))
    return app


build_app = create_app
