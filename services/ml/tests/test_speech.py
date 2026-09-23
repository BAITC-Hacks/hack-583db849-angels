import asyncio
from decimal import Decimal

import pytest

from services.ml.app.errors import ServiceError
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.errors import GatewayOutputError
from services.ml.app.gateway.media import MediaGatewayResult, MediaRequest
from services.ml.app.modules.speech import SpeechService
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import SpeechRequest


class FakeMediaGateway:
    def __init__(
        self, *, content: bytes = b"synthetic-mp3", media_type: str = "audio/mpeg"
    ) -> None:
        self.content = content
        self.media_type = media_type
        self.requests: list[MediaRequest] = []

    async def execute(self, request: MediaRequest) -> MediaGatewayResult:
        self.requests.append(request)
        return MediaGatewayResult(
            content=self.content,
            media_type=self.media_type,
            billed_units=request.estimated_units,
            provider=Provider.DEEPGRAM,
            model="aura-asteria-en",
            replayed=True,
            cached=False,
        )


def service(gateway: FakeMediaGateway) -> SpeechService:
    return SpeechService(gateway, ScenarioRepository.load(ROOT_SCENARIOS))


def test_scenario_request_uses_the_private_character_voice() -> None:
    gateway = FakeMediaGateway()

    result = asyncio.run(
        service(gateway).synthesize(
            SpeechRequest(text="Synthetic line.", scenarioId="conflict-resolution")
        )
    )

    assert result == b"synthetic-mp3"
    assert gateway.requests[0].parameters == {"voice": "aura-asteria-en"}
    assert gateway.requests[0].content == b"Synthetic line."
    assert gateway.requests[0].estimated_units == Decimal("0.015")


def test_direct_voice_is_available_for_test_tooling() -> None:
    gateway = FakeMediaGateway()

    asyncio.run(
        service(gateway).synthesize(
            SpeechRequest(text="Tooling line.", voice="aura-2-thalia-en")
        )
    )

    assert gateway.requests[0].parameters == {"voice": "aura-2-thalia-en"}


def test_unknown_scenario_is_a_safe_not_found() -> None:
    gateway = FakeMediaGateway()

    with pytest.raises(ServiceError) as caught:
        asyncio.run(
            service(gateway).synthesize(
                SpeechRequest(text="Line.", scenarioId="unknown")
            )
        )

    assert caught.value.status_code == 404
    assert caught.value.code == "SCENARIO_NOT_FOUND"
    assert gateway.requests == []


@pytest.mark.parametrize(
    ("content", "media_type"),
    [(b"", "audio/mpeg"), (b"not-mp3", "application/octet-stream")],
)
def test_invalid_speech_media_is_rejected(content: bytes, media_type: str) -> None:
    gateway = FakeMediaGateway(content=content, media_type=media_type)

    with pytest.raises(GatewayOutputError, match="invalid"):
        asyncio.run(
            service(gateway).synthesize(
                SpeechRequest(text="Synthetic line.", voice="aura-asteria-en")
            )
        )
