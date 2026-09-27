"""Author deterministic synthetic follow-up cassettes, without provider calls."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider
from services.ml.app.gateway.types import GatewayRequest, ProviderResponse
from services.ml.app.modules.follow_up import FollowUpProposal, FollowUpWriter
from services.ml.app.schemas.contracts import FollowUpRequest


ROOT = Path(__file__).resolve().parents[3]
CONTRACT = ROOT / "docs/contracts/examples/candidate-a/ml"
SEED = ROOT / "seed/candidates"


class RecordingGateway:
    def __init__(self, answer: dict) -> None:
        self.answer = answer
        self.requests: list[GatewayRequest[FollowUpProposal]] = []

    async def execute(self, request: GatewayRequest[FollowUpProposal]):
        from services.ml.app.gateway.types import GatewayResult

        self.requests.append(request)
        return GatewayResult(
            output=FollowUpProposal.model_validate(self.answer), provider=Provider.OPENAI,
            model="gpt-6-luna", input_tokens=0, output_tokens=0, replayed=True, cached=False,
        )


async def main() -> None:
    store = FileCassetteStore()
    inputs: list[tuple[dict, dict]] = [
        (json.loads((CONTRACT / "interview-follow-up.request.json").read_text()),
         json.loads((CONTRACT / "interview-follow-up.response.json").read_text())),
    ]
    for letter in "abc":
        snapshot = json.loads((SEED / letter / "snapshot.json").read_text())
        answer = json.loads((SEED / letter / "follow-up-answer.json").read_text())
        expected = json.loads((SEED / letter / "expected-follow-up.json").read_text())
        brief = json.loads((SEED / letter / "expected-brief.json").read_text())
        inputs.append(({
            "candidate": {
                "candidateId": f"00000000-0000-4000-8000-00000000000{letter}",
                "application": snapshot["application"], "test": snapshot["test"],
                "englishCertificate": snapshot["englishCertificate"],
            },
            "plannedQuestions": [{"focus": item["focus"], "question": item["question"]} for item in brief["questions"]],
            "question": answer["question"],
            "answer": answer["segments"], "earlier": [],
        }, expected))
    for raw_request, answer in inputs:
        gateway = RecordingGateway(answer)
        actual = await FollowUpWriter(gateway).write(FollowUpRequest.model_validate(raw_request))
        if actual.model_dump(mode="json") != answer:
            raise ValueError("synthetic follow-up suggestion did not pass validation")
        request = gateway.requests[0]
        await store.save(request, Provider.OPENAI, "gpt-6-luna", ProviderResponse(
            content=json.dumps(answer, ensure_ascii=False), input_tokens=0,
            output_tokens=0, request_id="synthetic-follow-up",
        ))


if __name__ == "__main__":
    asyncio.run(main())
