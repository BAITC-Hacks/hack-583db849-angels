"""Scenario-aware character speech synthesis through the media gateway."""

from __future__ import annotations

from decimal import Decimal

from ..errors import ServiceError
from ..gateway.config import TaskName
from ..gateway.errors import GatewayOutputError
from ..gateway.media import MediaGateway, MediaRequest
from ..scenarios import ScenarioRepository
from ..schemas.contracts import SpeechRequest


class SpeechService:
    def __init__(
        self, gateway: MediaGateway, scenarios: ScenarioRepository
    ) -> None:
        self._gateway = gateway
        self._scenarios = scenarios

    async def synthesize(self, request: SpeechRequest) -> bytes:
        voice = request.voice
        if request.scenarioId is not None:
            scenario = self._scenarios.get(request.scenarioId)
            if scenario is None:
                raise ServiceError(
                    status_code=404,
                    code="SCENARIO_NOT_FOUND",
                    message="Scenario not found.",
                )
            voice = scenario.voice
        if voice is None:
            # The contract validator makes this unreachable, but keep the provider
            # boundary total if the service is ever called outside FastAPI.
            raise GatewayOutputError("speech voice is unavailable")

        content = request.text.encode("utf-8")
        result = await self._gateway.execute(
            MediaRequest(
                task=TaskName.SPEECH,
                operation="speech",
                content=content,
                content_type="text/plain; charset=utf-8",
                parameters={"voice": voice},
                estimated_units=Decimal(len(request.text)) / Decimal(1000),
            )
        )
        if result.media_type != "audio/mpeg" or not result.content:
            raise GatewayOutputError("speech output is invalid")
        return result.content
