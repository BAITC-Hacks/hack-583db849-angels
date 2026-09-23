import asyncio
from dataclasses import dataclass
import json

import pytest
from pydantic import ValidationError

from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.errors import GatewayCassetteMissingError, GatewayOutputError
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.actor import (
    ActorOutput,
    PACKAGED_PROMPT,
    ROOT_PROMPT,
    ScenarioActor,
)
from services.ml.app.modules.director import DirectorOutcome
from services.ml.app.scenarios import ROOT_SCENARIOS, ScenarioRepository
from services.ml.app.schemas.contracts import DirectorDecision, Turn


class EmptyCassettes:
    async def load(self, request, provider, model):
        del request, provider, model
        raise GatewayCassetteMissingError("no synthetic cassette")

    async def save(self, request, provider, model, response):
        del request, provider, model, response


@dataclass
class FakeProvider:
    responses: list[str]

    def __post_init__(self) -> None:
        self.requests: list[ProviderRequest] = []

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        self.requests.append(request)
        return ProviderResponse(
            content=self.responses.pop(0),
            input_tokens=20,
            output_tokens=10,
        )


def actor_with(responses: list[str]):
    provider = FakeProvider(responses)
    gateway = ModelGateway(
        mode="live",
        configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=EmptyCassettes(),
    )
    return ScenarioActor(gateway), provider


@pytest.fixture
def scenario():
    loaded = ScenarioRepository.load(ROOT_SCENARIOS).get("conflict-resolution")
    assert loaded is not None
    return loaded


@pytest.fixture
def outcome():
    return DirectorOutcome(
        stage="in-progress",
        ended=False,
        decision=DirectorDecision(
            beat="opening",
            matchedAnswerType="acknowledge",
            similarity=0.91,
            nextBeat="trust",
            reason="Safe technical reason.",
        ),
        character_intent="Calms down and asks for a concrete process.",
    )


def turn(text: str = "Can we focus on a fair review process?") -> Turn:
    return Turn(
        turnId="turn_01",
        speaker="candidate",
        text=text,
        startedAt="2026-09-25T10:00:00Z",
        endedAt="2026-09-25T10:00:10Z",
    )


def test_actor_uses_external_prompt_and_contract_safe_context(scenario, outcome) -> None:
    actor, provider = actor_with(['{"text":"How would that review process work?"}'])

    line = asyncio.run(actor.generate(scenario, outcome, [turn()]))

    assert line == "How would that review process work?"
    request = provider.requests[0]
    assert request.prompt == ROOT_PROMPT.read_text(encoding="utf-8").strip()
    assert request.max_tokens == 180
    assert request.payload["direction"]["characterIntent"] == outcome.character_intent
    assert request.payload["transcript"][0]["text"] == turn().text
    assert "profile" not in str(request.payload).lower()


def test_actor_prompt_is_packaged_for_the_standalone_image() -> None:
    assert PACKAGED_PROMPT.read_text(encoding="utf-8") == ROOT_PROMPT.read_text(
        encoding="utf-8"
    )


def test_off_topic_turn_can_be_gently_returned_to_the_scenario(scenario, outcome) -> None:
    actor, _ = actor_with(
        ['{"text":"Let us come back to the module change. What can we agree today?"}']
    )

    line = asyncio.run(actor.generate(scenario, outcome, [turn("Do you like films?")]))

    assert "come back to the module change" in line


@pytest.mark.parametrize(
    "unsafe",
    [
        "That was the correct answer.",
        "I would give that response a score of four.",
        "This will help your admission.",
        "What is your name?",
        "You should say that Timur was wrong.",
    ],
)
def test_actor_output_rejects_grading_admission_hints_and_personal_questions(
    unsafe: str,
) -> None:
    with pytest.raises(ValidationError, match="safety policy"):
        ActorOutput(text=unsafe)


def test_unsafe_or_overlong_output_retries_once(scenario, outcome) -> None:
    too_long = " ".join(["word"] * 61)
    actor, provider = actor_with(
        [
            '{"text":"That was the perfect answer."}',
            '{"text":"I need a concrete plan for today."}',
        ]
    )

    line = asyncio.run(actor.generate(scenario, outcome, [turn()]))

    assert line == "I need a concrete plan for today."
    assert len(provider.requests) == 2

    with pytest.raises(ValidationError, match="60 words"):
        ActorOutput(text=too_long)


def test_two_policy_violations_fail_after_one_retry(scenario, outcome) -> None:
    actor, provider = actor_with(
        [
            '{"text":"That was the correct answer."}',
            '{"text":"I will score your response now."}',
        ]
    )

    with pytest.raises(GatewayOutputError, match="schema validation"):
        asyncio.run(actor.generate(scenario, outcome, [turn()]))

    assert len(provider.requests) == 2


def test_actor_output_does_not_repeat_the_private_hidden_motive(scenario, outcome) -> None:
    actor, provider = actor_with(
        [
            json.dumps({"text": scenario.hiddenMotive}),
            '{"text":"I need to know the team will respect my work."}',
        ]
    )

    line = asyncio.run(actor.generate(scenario, outcome, [turn()]))

    assert scenario.hiddenMotive not in line
    assert len(provider.requests) == 2
