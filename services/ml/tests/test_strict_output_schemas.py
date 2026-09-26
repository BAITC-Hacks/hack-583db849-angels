"""Every schema the gateway asks a model to fill must pass OpenAI's strict JSON mode.

Strict mode refuses a schema unless each object lists every property in
`required` and forbids extra ones. A field with a default breaks that, and
only a live call shows it: replay cassettes never reach the provider. This
test finds it offline, for every output schema the service sends.
"""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from services.ml.app.modules.actor import ActorOutput
from services.ml.app.modules.judge import JudgeOutput
from services.ml.app.modules.quality_calibration import CalibrationProposal
from services.ml.app.modules.quality_guard import QuestionProposal
from services.ml.app.schemas.contracts import BriefResult, ConsistencyResult, DraftResult


def _objects(node: object, path: str = "$"):
    if isinstance(node, dict):
        if node.get("type") == "object" or "properties" in node:
            yield path, node
        for key, value in node.items():
            yield from _objects(value, f"{path}.{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _objects(value, f"{path}[{index}]")


@pytest.mark.parametrize(
    "schema",
    [ActorOutput, BriefResult, JudgeOutput, DraftResult, ConsistencyResult, QuestionProposal, CalibrationProposal],
    ids=lambda schema: schema.__name__,
)
def test_output_schema_is_accepted_by_strict_json_mode(schema: type[BaseModel]) -> None:
    for path, node in _objects(schema.model_json_schema()):
        properties = set(node.get("properties", {}))
        assert set(node.get("required", [])) == properties, f"{schema.__name__} {path}: every property must be required"
        assert node.get("additionalProperties") is False, f"{schema.__name__} {path}: extra properties must be forbidden"
