"""The planted M5 cases replay from authored, synthetic cassettes offline."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import patch

from services.ml.app.gateway.cassettes import CassetteEnvelope, FileCassetteStore
from services.ml.app.gateway.config import load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.modules.quality_calibration import CalibrationWording, compute_drift
from services.ml.app.modules.quality_guard import InterviewQuestionAnalyzer, load_quality_policy
from services.ml.app.providers.openai import OpenAIProvider
from services.ml.app.schemas.contracts import QualityCheckRequest


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
CASSETTES = ROOT / "fixtures/cassettes"


def read(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def replay_gateway() -> ModelGateway:
    return ModelGateway(
        mode="replay", configuration=load_models_configuration(),
        providers={}, cassettes=FileCassetteStore(CASSETTES),
    )


def test_quality_cassettes_are_synthetic_and_contain_no_input_transcript() -> None:
    paths = list((CASSETTES / "quality_check").glob("*.json"))
    assert len(paths) == 3
    for path in paths:
        envelope = CassetteEnvelope.model_validate_json(path.read_text(encoding="utf-8"))
        assert envelope.request_hash == path.stem
        assert envelope.request_id == "synthetic-m5-quality"
        content = path.read_text(encoding="utf-8")
        assert "candidateId" not in content
        assert "Thanks for coming in" not in content
        assert "interviewerRef" not in content


def test_planted_interview_replays_with_grounded_questions_offline() -> None:
    request = QualityCheckRequest.model_validate(
        read(EXAMPLES / "quality-check-interview.request.json")
    )
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        signals = asyncio.run(InterviewQuestionAnalyzer(replay_gateway()).analyze(request))
    assert [item.kind for item in signals] == [
        "leading_question", "off_limits_question", "coverage_gap",
    ]
    assert [item.evidence[0].sourceId for item in signals[:2]] == ["iturn_03", "iturn_07"]


def test_frozen_and_demo_calibration_replay_plant_values_drift_offline() -> None:
    cases = [
        (read(EXAMPLES / "quality-check-calibration.request.json"), 1.1),
        ({
            "kind": "calibration", "interviewerRef": "synthetic-interviewer-a",
            "periodFrom": "2026-09-01", "periodTo": "2026-10-01",
            "history": read(ROOT / "seed/quality-history.json"),
        }, 1.7),
    ]
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
        for raw, expected_delta in cases:
            request = QualityCheckRequest.model_validate(raw)
            _, selected, _ = compute_drift(request, load_quality_policy())
            assert selected == [next(item for item in selected if item["competency"] == "V")]
            assert selected[0]["delta"] == expected_delta
            signals = asyncio.run(CalibrationWording(replay_gateway()).write(selected))
            assert len(signals) == 1
            assert signals[0].kind == "scale_drift"
            assert signals[0].competencies == ["V"]
            assert str(expected_delta) in signals[0].message
