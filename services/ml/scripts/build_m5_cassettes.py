"""Record synthetic M5 model wording without calling a remote provider."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.quality_calibration import (
    CalibrationProposal, CalibrationText, CalibrationWording, compute_drift,
)
from services.ml.app.modules.quality_guard import (
    InterviewQuestionAnalyzer, QuestionProposal, load_quality_policy,
)
from services.ml.app.schemas.contracts import QualityCheckRequest


EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
CASSETTES = ROOT / "fixtures/cassettes"
RECORDED_AT = datetime(2026, 9, 26, tzinfo=timezone.utc)


def load(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


class SyntheticQualityProvider:
    """Authored fixture output belongs only to this offline cassette builder."""

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        if request.task.value != "quality_check":
            raise RuntimeError("unexpected model task")
        payload = request.payload
        if payload["mode"] == "interview":
            response = load(EXAMPLES / "quality-check-interview.response.json")
            output = QuestionProposal(signals=response["signals"])
        elif payload["mode"] == "calibration":
            drift = payload["drift"]
            if len(drift) != 1 or drift[0]["competency"] != "V":
                raise RuntimeError("unexpected synthetic drift")
            if drift[0]["delta"] == 1.1:
                response = load(EXAMPLES / "quality-check-calibration.response.json")
                signal = response["signals"][0]
                output = CalibrationProposal(signals=[CalibrationText(
                    competency="V", message=signal["message"],
                    recommendation=signal["recommendation"],
                )])
            elif drift[0]["delta"] == 1.7:
                output = CalibrationProposal(signals=[CalibrationText(
                    competency="V",
                    message="Values scores run 1.7 above the panel (3.7 against 2.0).",
                    recommendation="Review recent Values answers against the rubric with another interviewer.",
                )])
            else:
                raise RuntimeError("unexpected synthetic delta")
        else:
            raise RuntimeError("unexpected quality-check mode")
        return ProviderResponse(
            content=output.model_dump_json(), input_tokens=180, output_tokens=120,
            request_id="synthetic-m5-quality",
        )


async def build() -> None:
    gateway = ModelGateway(
        mode="record", configuration=load_models_configuration(),
        providers={Provider.OPENAI: SyntheticQualityProvider()},
        cassettes=FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    interview = QualityCheckRequest.model_validate(
        load(EXAMPLES / "quality-check-interview.request.json")
    )
    signals = await InterviewQuestionAnalyzer(gateway).analyze(interview)
    if [item.kind for item in signals] != [
        "leading_question", "off_limits_question", "coverage_gap",
    ]:
        raise RuntimeError("synthetic interview signals changed")

    calibration_inputs = [
        load(EXAMPLES / "quality-check-calibration.request.json"),
        {
            "kind": "calibration", "interviewerRef": "synthetic-interviewer-a",
            "periodFrom": "2026-09-01", "periodTo": "2026-10-01",
            "history": load(ROOT / "seed/quality-history.json"),
        },
    ]
    for raw in calibration_inputs:
        request = QualityCheckRequest.model_validate(raw)
        _, selected, _ = compute_drift(request, load_quality_policy())
        signals = await CalibrationWording(gateway).write(selected)
        if len(signals) != 1 or signals[0].competencies != ["V"]:
            raise RuntimeError("synthetic calibration signal changed")


if __name__ == "__main__":
    asyncio.run(build())
