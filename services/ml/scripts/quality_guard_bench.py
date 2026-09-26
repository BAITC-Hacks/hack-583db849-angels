"""Bench M5's real HTTP route against synthetic process-quality cases in replay."""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.config import Settings
from services.ml.app.evidence import verify_evidence
from services.ml.app.main import create_app
from services.ml.app.modules.quality_calibration import compute_drift, talk_share
from services.ml.app.modules.quality_guard import interviewer_sources, load_quality_policy, safe_process_text
from services.ml.app.providers.openai import OpenAIProvider
from services.ml.app.schemas.contracts import QualityCheckRequest, QualityCheckResult


EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
TOKEN = {"X-Internal-Token": "bench-internal-token"}
PATH = "/internal/v1/quality-check"


def _load(path: Path) -> QualityCheckRequest:
    return QualityCheckRequest.model_validate_json(path.read_text(encoding="utf-8"))


def _post(client: TestClient, request: QualityCheckRequest) -> QualityCheckResult:
    response = client.post(PATH, json=request.model_dump(mode="json"), headers=TOKEN)
    if response.status_code != 200:
        raise AssertionError(f"quality-check HTTP status {response.status_code}")
    return QualityCheckResult.model_validate(response.json())


def bench(
    interview_path: Path, calibration_path: Path, *, planted: bool = True,
) -> dict[str, int]:
    interview = _load(interview_path)
    calibration = _load(calibration_path)
    if interview.kind != "interview" or calibration.kind != "calibration":
        raise ValueError("bench needs one interview and one calibration request")
    policy = load_quality_policy()
    with TemporaryDirectory(prefix="m5-bench-") as scratch:
        settings = Settings(
            ml_internal_token=TOKEN["X-Internal-Token"], uploads_dir=Path(scratch),
            gateway_mode="replay", budget_usd_cap=Decimal("20"), demo_mode=False,
            usage_log_path=Path(scratch) / "usage.jsonl",
        )
        with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("network forbidden")):
            client = TestClient(create_app(settings), raise_server_exceptions=False)
            interview_result = _post(client, interview)
            calibration_result = _post(client, calibration)

    sources = interviewer_sources(interview.transcript)
    for signal in interview_result.signals:
        assert signal.kind in ("leading_question", "off_limits_question", "coverage_gap")
        assert safe_process_text(signal.message, policy)
        assert safe_process_text(signal.recommendation, policy)
        if signal.kind == "coverage_gap":
            assert signal.competencies and not signal.evidence
        else:
            assert not signal.competencies and signal.evidence
            evidence, _, dropped = verify_evidence(signal.evidence, sources)
            assert not dropped and len(evidence) == len(signal.evidence)
    assert interview_result.talkShare == talk_share(interview.transcript)
    assert interview_result.drift == [] and interview_result.interviews is None

    rows, selected, count = compute_drift(calibration, policy)
    assert calibration_result.drift == rows
    assert calibration_result.interviews == count
    assert calibration_result.talkShare is None
    assert [signal.competencies for signal in calibration_result.signals] == [
        [item["competency"]] for item in selected
    ]
    for signal in calibration_result.signals:
        assert signal.kind == "scale_drift" and not signal.evidence
        assert safe_process_text(signal.message, policy)
        assert safe_process_text(signal.recommendation, policy)
    if planted:
        assert [item.kind for item in interview_result.signals] == [
            "leading_question", "off_limits_question", "coverage_gap",
        ]
        assert [item.evidence[0].sourceId for item in interview_result.signals[:2]] == [
            "iturn_03", "iturn_07",
        ]
        assert interview_result.signals[2].competencies == ["V", "I"]
        assert [(item.competencies, item.kind) for item in calibration_result.signals] == [
            (["V"], "scale_drift"),
        ]
    return {
        "interview_signals": len(interview_result.signals),
        "calibration_signals": len(calibration_result.signals),
        "interviews": count,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--interview-request", type=Path,
        default=EXAMPLES / "quality-check-interview.request.json",
    )
    parser.add_argument(
        "--calibration-request", type=Path,
        default=EXAMPLES / "quality-check-calibration.request.json",
    )
    parser.add_argument("--generic", action="store_true", help="Skip the A planted-signal pattern")
    arguments = parser.parse_args()
    result = bench(
        arguments.interview_request, arguments.calibration_request,
        planted=not arguments.generic,
    )
    print("M5 replay bench passed: " + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
