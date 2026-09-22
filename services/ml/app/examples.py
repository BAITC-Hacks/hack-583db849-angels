"""Load and validate frozen candidate-A contract examples for F0 stubs."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, TypeAdapter

from .schemas.contracts import ScenarioBrief


ROOT = Path(__file__).resolve().parents[3]
ML_EXAMPLES = ROOT / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
Model = TypeVar("Model", bound=BaseModel)


@lru_cache
def load_example(filename: str, model: type[Model]) -> Model:
    payload = json.loads((ML_EXAMPLES / filename).read_text(encoding="utf-8"))
    return model.model_validate(payload)


@lru_cache
def load_scenarios() -> tuple[ScenarioBrief, ...]:
    payload = json.loads((ML_EXAMPLES / "scenarios.response.json").read_text(encoding="utf-8"))
    scenarios = TypeAdapter(list[ScenarioBrief]).validate_python(payload)
    return tuple(scenarios)
