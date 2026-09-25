import asyncio
import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from services.ml.app.gateway.config import Provider, TaskName
from services.ml.app.gateway.types import GatewayResult
from services.ml.app.modules.brief import BriefGenerator
from services.ml.app.schemas.contracts import BriefRequest, BriefResult


ROOT = Path(__file__).resolve().parents[3]
EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"


class FakeGateway:
    def __init__(self, output: BriefResult) -> None:
        self.output = output
        self.requests = []

    async def execute(self, request):
        self.requests.append(request)
        return GatewayResult(
            output=self.output, provider=Provider.OPENAI, model="synthetic-model",
            input_tokens=1, output_tokens=1, replayed=True, cached=False,
        )


def test_brief_generator_uses_typed_gateway_without_profile() -> None:
    request = BriefRequest.model_validate(json.loads(
        (EXAMPLES / "brief.request.json").read_text(encoding="utf-8")
    ))
    response = BriefResult.model_validate(json.loads(
        (EXAMPLES / "brief.response.json").read_text(encoding="utf-8")
    ))
    gateway = FakeGateway(response)
    output = asyncio.run(BriefGenerator(gateway).generate(request))
    assert output == response
    assert len(gateway.requests) == 1
    sent = gateway.requests[0]
    assert sent.task == TaskName.BRIEF
    assert sent.output_schema is BriefResult
    assert sent.payload["attempt"] == 1
    assert sent.payload["candidate"]["candidateId"] == request.candidate.candidateId
    assert sent.payload["simulationEnglish"]["cefrEstimate"] == "B2"
    assert "profile" not in str(sent.payload)
    assert "invision_knowledge" in sent.prompt
    assert "motivation" in sent.prompt
    assert {question.focus for question in output.questions} == {
        "D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"
    }


def test_brief_schema_rejects_missing_focus() -> None:
    payload = json.loads((EXAMPLES / "brief.response.json").read_text(encoding="utf-8"))
    payload["questions"] = [
        question for question in payload["questions"] if question["focus"] != "motivation"
    ]
    with pytest.raises(ValidationError, match="at least one question per focus"):
        BriefResult.model_validate(payload)
