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
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
PACKAGED_EXAMPLES = PACKAGE_ROOT / "stub_data" / "examples.json"
Model = TypeVar("Model", bound=BaseModel)


@lru_cache
def _packaged_examples() -> dict[str, object]:
    return json.loads(PACKAGED_EXAMPLES.read_text(encoding="utf-8"))


@lru_cache
def load_example(filename: str, model: type[Model]) -> Model:
    source = ML_EXAMPLES / filename
    payload = (
        json.loads(source.read_text(encoding="utf-8"))
        if source.is_file()
        else _packaged_examples()[filename]
    )
    return model.model_validate(payload)


@lru_cache
def load_scenarios() -> tuple[ScenarioBrief, ...]:
    source = ML_EXAMPLES / "scenarios.response.json"
    payload = (
        json.loads(source.read_text(encoding="utf-8"))
        if source.is_file()
        else _packaged_examples()["scenarios.response.json"]
    )
    scenarios = TypeAdapter(list[ScenarioBrief]).validate_python(payload)
    return tuple(scenarios)
