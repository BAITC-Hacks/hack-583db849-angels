"""Bounded, policy-validated generation of the scenario character's next line."""

from __future__ import annotations

from pathlib import Path
import re
from typing import Protocol, Sequence

from pydantic import BaseModel, ConfigDict, field_validator

from ..gateway.config import TaskName
from ..gateway.types import GatewayRequest, GatewayResult
from ..schemas.contracts import ScenarioConfig, Turn
from .director import DirectorOutcome


ROOT_PROMPT = (
    Path(__file__).resolve().parents[4] / "config" / "prompts" / "simulation-actor.md"
)
PACKAGED_PROMPT = (
    Path(__file__).resolve().parents[2]
    / "stub_data"
    / "prompts"
    / "simulation-actor.md"
)
DEFAULT_PROMPT = ROOT_PROMPT if ROOT_PROMPT.is_file() else PACKAGED_PROMPT

_FORBIDDEN_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\b(?:score|scored|scoring|grade|graded|grading|rating|points?)\b",
        r"\b(?:admission|admissions|admit|accepted|rejected|selection)\b",
        r"\b(?:correct|ideal|expected|perfect|best)\s+(?:answer|response)\b",
        r"\b(?:excellent|great|good)\s+(?:answer|response)\b",
        r"\b(?:answer\s*type|branch|competenc(?:y|ies)|hidden\s+motive|system\s+prompt)\b",
        r"\b(?:what(?:'s| is) your name|email address|phone number|home address|family income|personal data)\b",
        r"\b(?:how old are you|where do you live|which school do you attend)\b",
        r"\b(?:your email|your phone|your age|your gender|your nationality|your religion|your income|your iin|your passport)\b",
        r"\b(?:you should say|you were supposed to say|the right thing to say)\b",
    )
)


class ActorOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str

    @field_validator("text")
    @classmethod
    def safe_bounded_line(cls, text: str) -> str:
        line = text.strip()
        if not line:
            raise ValueError("actor line cannot be empty")
        if len(line.split()) > 60:
            raise ValueError("actor line is longer than 60 words")
        if any(pattern.search(line) for pattern in _FORBIDDEN_PATTERNS):
            raise ValueError("actor line violates the character safety policy")
        return line


class ActorGateway(Protocol):
    async def execute(
        self, request: GatewayRequest[ActorOutput]
    ) -> GatewayResult[ActorOutput]: ...


class ScenarioActor:
    def __init__(
        self,
        gateway: ActorGateway,
        *,
        prompt_path: Path = DEFAULT_PROMPT,
    ) -> None:
        self._gateway = gateway
        self._prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not self._prompt:
            raise ValueError("simulation actor prompt is empty")

    async def generate(
        self,
        scenario: ScenarioConfig,
        outcome: DirectorOutcome,
        turns: Sequence[Turn],
    ) -> str:
        output_schema = _output_schema(scenario.hiddenMotive)
        result = await self._gateway.execute(
            GatewayRequest(
                task=TaskName.SIMULATION_ACTOR,
                prompt=self._prompt,
                payload={
                    "scenario": {
                        "situation": scenario.situation,
                        "candidateRole": scenario.yourRole,
                        "goal": scenario.goal,
                        "character": scenario.character.model_dump(mode="json"),
                        "hiddenMotive": scenario.hiddenMotive,
                    },
                    "direction": {
                        "stage": outcome.stage,
                        "ended": outcome.ended,
                        "beat": outcome.decision.beat,
                        "characterIntent": outcome.character_intent,
                    },
                    "transcript": [turn.model_dump(mode="json") for turn in turns],
                },
                output_schema=output_schema,
            )
        )
        return result.output.text


def _output_schema(hidden_motive: str) -> type[ActorOutput]:
    normalized_motive = " ".join(hidden_motive.casefold().split())

    class ScenarioActorOutput(ActorOutput):
        @field_validator("text")
        @classmethod
        def does_not_reveal_hidden_motive(cls, text: str) -> str:
            normalized_line = " ".join(text.casefold().split())
            if normalized_motive and normalized_motive in normalized_line:
                raise ValueError("actor line reveals private scenario context")
            return text

    return ScenarioActorOutput
