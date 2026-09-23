"""FastAPI application factory for the internal ML service."""

from __future__ import annotations

from fastapi import FastAPI

from .auth import internal_auth_dependency
from .config import Settings, load_settings
from .errors import install_error_handlers
from .routes.audio import audio_router
from .routes.core import core_router
from .routes.extended import extended_router
from .schemas.contracts import HealthResponse
from .gateway.usage import FileUsageStore


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or load_settings()
    app = FastAPI(title="AI Leader ID ML API", version="1.0.0")
    install_error_handlers(app)
    authenticate = internal_auth_dependency(resolved.ml_internal_token)
    usage_store = FileUsageStore(resolved.usage_log_path)

    @app.get(
        "/internal/v1/health",
        response_model=HealthResponse,
    )
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    app.include_router(core_router(authenticate))
    app.include_router(audio_router(authenticate, resolved.uploads_dir))
    app.include_router(
        extended_router(
            authenticate, usage_store, resolved.gateway_mode, resolved.budget_usd_cap
        )
    )
    return app


build_app = create_app
