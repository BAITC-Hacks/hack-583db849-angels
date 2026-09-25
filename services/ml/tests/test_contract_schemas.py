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
        ("transcribe-turn.request.json", contracts.TranscribeRequest),
        ("transcribe-turn.response.json", contracts.TranscribeResult),
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


def test_after_consistency_example_preserves_saved_before_items() -> None:
    before = json.loads((EXAMPLES / "consistency-before.response.json").read_text(encoding="utf-8"))["items"]
    request = json.loads((EXAMPLES / "consistency-after.request.json").read_text(encoding="utf-8"))
    after = json.loads((EXAMPLES / "consistency-after.response.json").read_text(encoding="utf-8"))["items"]

    assert request["beforeItems"] == before
    assert len(after) >= len(before)
    for original, updated in zip(before, after, strict=False):
        assert {key: updated[key] for key in ("itemId", "topic", "claim")} == {
            key: original[key] for key in ("itemId", "topic", "claim")
        }
        assert updated["askInInterview"] is None
    assert [item["status"] for item in after] == ["confirmed", "confirmed", "unverified"]
    assert after[0]["observation"]["metric"]["source"] == "simulation"
    assert after[0]["observation"]["text"] == (
        "The simulation measured B2, and nothing in the interview points higher; "
        "the C2 self-rating is not supported."
    )


def test_before_items_are_only_allowed_for_after_stage() -> None:
    request = json.loads((EXAMPLES / "consistency-after.request.json").read_text(encoding="utf-8"))
    request["stage"] = "before"
    with pytest.raises(ValueError, match="beforeItems is only allowed"):
        contracts.ConsistencyRequest.model_validate(request)
    request["beforeItems"] = []
    assert contracts.ConsistencyRequest.model_validate(request).beforeItems == []
    assert "beforeItems" not in contracts.ConsistencyRequest.model_json_schema()["required"]


def test_scenario_list_matches_the_public_scenario_schema() -> None:
    payload = json.loads((EXAMPLES / "scenarios.response.json").read_text(encoding="utf-8"))

    for scenario in payload:
        contracts.ScenarioBrief.model_validate(scenario)


def test_candidate_turn_requires_state() -> None:
    payload = json.loads(
        (EXAMPLES / "simulation-turn.request.json").read_text(encoding="utf-8")
    )
    payload.pop("state")

    with pytest.raises(ValueError, match="candidate turn comes with state"):
        contracts.TurnRequest.model_validate(payload)


def test_opening_turn_does_not_require_state() -> None:
    request = contracts.TurnRequest(scenarioId="conflict-resolution", turns=[])

    assert request.state is None


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "Hello."},
        {
            "text": "Hello.",
            "scenarioId": "conflict-resolution",
            "voice": "aura-asteria-en",
        },
    ],
)
def test_speech_requires_exactly_one_voice_selector(payload: dict[str, str]) -> None:
    with pytest.raises(ValueError, match="scenarioId or voice, exactly one"):
        contracts.SpeechRequest.model_validate(payload)


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "Hello.", "scenarioId": "conflict-resolution"},
        {"text": "Hello.", "voice": "aura-asteria-en"},
    ],
)
def test_speech_accepts_each_voice_selector(payload: dict[str, str]) -> None:
    contracts.SpeechRequest.model_validate(payload)


@pytest.mark.parametrize("confidence", [-0.01, 1.01])
def test_transcription_confidence_is_bounded(confidence: float) -> None:
    with pytest.raises(ValueError):
        contracts.TranscribedTurn(
            speaker="candidate",
            text="Synthetic answer.",
            startSec=0,
            endSec=1,
            confidence=confidence,
        )
