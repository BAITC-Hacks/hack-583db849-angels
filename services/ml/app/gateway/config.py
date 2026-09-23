"""Strict loading and validation for the shared model-task configuration."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
import json
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PACKAGE_ROOT = Path(__file__).resolve().parents[2]
ROOT_MODELS_PATH = Path(__file__).resolve().parents[4] / "config" / "models.json"
PACKAGED_MODELS_PATH = PACKAGE_ROOT / "stub_data" / "models.json"
DEFAULT_MODELS_PATH = (
    ROOT_MODELS_PATH if ROOT_MODELS_PATH.is_file() else PACKAGED_MODELS_PATH
)


class ModelConfigurationError(ValueError):
    """Raised when the model configuration cannot be parsed or validated."""


class Provider(str, Enum):
    OPENAI = "openai"
    DEEPGRAM = "deepgram"


class TaskName(str, Enum):
    SIMULATION_ACTOR = "simulation_actor"
    SIMULATION_ASSESSMENT = "simulation_assessment"
    BRIEF = "brief"
    INTERVIEW_DRAFT = "interview_draft"
    CONSISTENCY = "consistency"
    SURPRISE_QUESTION = "surprise_question"
    QUALITY_CHECK = "quality_check"
    TRANSCRIPTION = "transcription"
    SPEECH = "speech"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


PositiveMoney = Annotated[Decimal, Field(gt=0, allow_inf_nan=False)]


class TokenPricing(StrictModel):
    unit: Literal["million_tokens"]
    input_usd: PositiveMoney
    cached_input_usd: PositiveMoney
    output_usd: PositiveMoney

    @model_validator(mode="after")
    def cached_input_cannot_cost_more_than_input(self) -> "TokenPricing":
        if self.cached_input_usd > self.input_usd:
            raise ValueError("cached input pricing cannot exceed input pricing")
        return self


class MeteredPricing(StrictModel):
    unit: Literal["audio_minute", "thousand_characters"]
    usd: PositiveMoney


Pricing = Annotated[TokenPricing | MeteredPricing, Field(discriminator="unit")]


class ModelDefinition(StrictModel):
    provider: Provider
    pricing: Pricing


class TaskDefinition(StrictModel):
    provider: Provider
    model: str = Field(min_length=1)
    fallback_model: str = Field(min_length=1)
    max_tokens: int = Field(gt=0)
    request_cost_limit_usd: PositiveMoney
    cache_ttl_seconds: int = Field(gt=0)
    demo_seed_available: bool


class ModelsConfiguration(StrictModel):
    version: Literal[1]
    models: dict[str, ModelDefinition] = Field(min_length=1)
    tasks: dict[TaskName, TaskDefinition]

    @model_validator(mode="after")
    def validate_task_inventory_and_references(self) -> "ModelsConfiguration":
        missing = set(TaskName) - set(self.tasks)
        if missing:
            names = ", ".join(sorted(task.value for task in missing))
            raise ValueError(f"missing task configuration: {names}")

        for task_name, task in self.tasks.items():
            if task.model == task.fallback_model:
                raise ValueError(f"{task_name.value} must use a distinct fallback model")
            for role, model_name in (
                ("model", task.model),
                ("fallback_model", task.fallback_model),
            ):
                model = self.models.get(model_name)
                if model is None:
                    raise ValueError(
                        f"{task_name.value}.{role} references unknown model {model_name}"
                    )
                if model.provider != task.provider:
                    raise ValueError(
                        f"{task_name.value}.{role} provider does not match {model_name}"
                    )
        return self


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ModelConfigurationError(f"duplicate key in models configuration: {key}")
        result[key] = value
    return result


def load_models_configuration(
    path: Path = DEFAULT_MODELS_PATH,
) -> ModelsConfiguration:
    """Load configuration without initializing providers or reading API keys."""

    try:
        raw = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
        return ModelsConfiguration.model_validate(raw)
    except ModelConfigurationError:
        raise
    except (OSError, ValueError) as error:
        raise ModelConfigurationError(
            f"invalid models configuration at {path}"
        ) from error
