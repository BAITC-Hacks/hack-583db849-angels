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
from .gateway.config import load_models_configuration
from .gateway.media import MediaGateway, create_media_gateway
from .gateway.service import LazyModelGateway, ModelGateway, create_gateway
from .modules.actor import ScenarioActor
from .modules.assessment import AssessmentService
from .modules.brief import BriefGenerator, BriefService
from .modules.judge import SimulationJudge
from .metrics.languagetool import LocalLanguageTool
from .modules.director import ScenarioDirector
from .modules.interview_transcription import InterviewTranscriptionService
from .modules.matcher import LazyLocalMatcher
from .modules.simulation import SimulationService
from .modules.speech import SpeechService
from .modules.transcription import TurnTranscriptionService
from .scenarios import load_scenario_repository


def create_app(
    settings: Settings | None = None,
    *,
    media_gateway: MediaGateway | None = None,
    model_gateway: ModelGateway | None = None,
    simulation_service: SimulationService | None = None,
    assessment_service: AssessmentService | None = None,
    brief_service: BriefService | None = None,
) -> FastAPI:
    resolved = settings or load_settings()
    app = FastAPI(title="AI Leader ID ML API", version="1.0.0")
    install_error_handlers(app)
    authenticate = internal_auth_dependency(resolved.ml_internal_token)
    usage_store = FileUsageStore(resolved.usage_log_path)
    scenario_repository = load_scenario_repository()
    models = load_models_configuration()
    resolved_media_gateway = media_gateway or create_media_gateway(resolved, models)
    turn_transcription = TurnTranscriptionService(resolved_media_gateway)
    interview_transcription = InterviewTranscriptionService(resolved_media_gateway)
    speech_service = SpeechService(resolved_media_gateway, scenario_repository)
    resolved_model_gateway = model_gateway or LazyModelGateway(
        lambda: create_gateway(resolved, models)
    )
    resolved_simulation_service = simulation_service or SimulationService(
        scenario_repository,
        ScenarioDirector(LazyLocalMatcher()),
        ScenarioActor(resolved_model_gateway),
    )
    resolved_assessment_service = assessment_service or AssessmentService(
        scenario_repository,
        SimulationJudge(resolved_model_gateway),
        LocalLanguageTool(),
    )
    resolved_brief_service = brief_service or BriefService(
        BriefGenerator(resolved_model_gateway)
    )

    @app.get(
        "/internal/v1/health",
        response_model=HealthResponse,
    )
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    app.include_router(
        core_router(
            authenticate,
            scenario_repository,
            resolved_simulation_service,
            resolved_assessment_service,
            resolved_brief_service,
        )
    )
    app.include_router(
        audio_router(
            authenticate,
            resolved.uploads_dir,
            turn_transcription,
            interview_transcription,
            speech_service,
        )
    )
    app.include_router(
        extended_router(
            authenticate, usage_store, resolved.gateway_mode, resolved.budget_usd_cap
        )
    )
    return app


build_app = create_app
