import json
from pathlib import Path

import pytest
from pydantic import BaseModel

from services.ml.app.schemas import contracts


EXAMPLES = (
    Path(__file__).resolve().parents[3] / "docs" / "contracts" / "examples" / "candidate-a" / "ml"
)


@pytest.mark.parametrize(
    ("filename", "model"),
    [
        ("simulation-turn.request.json", contracts.TurnRequest),
        ("simulation-turn.response.json", contracts.TurnResult),
        ("simulation-assessment.request.json", contracts.AssessmentRequest),
        ("simulation-assessment.response.json", contracts.AssessmentResult),
        ("brief.request.json", contracts.BriefRequest),
        ("brief.response.json", contracts.BriefResult),
        ("transcribe.request.json", contracts.TranscribeRequest),
        ("transcribe.response.json", contracts.TranscribeResult),
        ("consistency-before.request.json", contracts.ConsistencyRequest),
        ("consistency-before.response.json", contracts.ConsistencyResult),
        ("consistency-after.request.json", contracts.ConsistencyRequest),
        ("consistency-after.response.json", contracts.ConsistencyResult),
        ("surprise-question.request.json", contracts.SurpriseRequest),
        ("surprise-question.response.json", contracts.SurpriseResult),
        ("interview-draft.request.json", contracts.DraftRequest),
        ("interview-draft.response.json", contracts.DraftResult),
        ("quality-check-interview.request.json", contracts.QualityCheckRequest),
        ("quality-check-interview.response.json", contracts.QualityCheckResult),
        ("quality-check-calibration.request.json", contracts.QualityCheckRequest),
        ("quality-check-calibration.response.json", contracts.QualityCheckResult),
        ("usage.response.json", contracts.Usage),
        ("scenario-config.conflict-resolution.json", contracts.ScenarioConfig),
    ],
)
def test_candidate_a_examples_match_the_frozen_schemas(
    filename: str, model: type[BaseModel]
) -> None:
    payload = json.loads((EXAMPLES / filename).read_text(encoding="utf-8"))

    model.model_validate(payload)


def test_scenario_list_matches_the_public_scenario_schema() -> None:
    payload = json.loads((EXAMPLES / "scenarios.response.json").read_text(encoding="utf-8"))

    for scenario in payload:
        contracts.ScenarioBrief.model_validate(scenario)
