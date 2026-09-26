"""Build synthetic A/B/C surprise-question cassettes without provider calls."""

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
from services.ml.app.gateway.config import Provider, TaskName, load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.surprise_question import SurpriseProposal, SurpriseQuestionService
from services.ml.app.schemas.contracts import SurpriseRequest, SurpriseResult


EXAMPLES = ROOT / "docs/contracts/examples/candidate-a/ml"
RECORDED_AT = datetime(2026, 9, 26, tzinfo=timezone.utc)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def seed_request(label: str) -> SurpriseRequest:
    if label == "a":
        return SurpriseRequest.model_validate(load(EXAMPLES / "surprise-question.request.json"))
    snapshot = load(ROOT / "seed/candidates" / label / "snapshot.json")
    return SurpriseRequest.model_validate({
        "candidate": {
            "candidateId": f"synthetic-{label}",
            "application": snapshot["application"],
            "test": snapshot["test"],
            "englishCertificate": snapshot.get("englishCertificate"),
        }
    })


class SyntheticProvider:
    def __init__(self, proposal: SurpriseProposal) -> None:
        self.proposal = proposal

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        if request.task is not TaskName.SURPRISE_QUESTION:
            raise RuntimeError("unexpected synthetic task")
        return ProviderResponse(
            content=self.proposal.model_dump_json(),
            input_tokens=120,
            output_tokens=60,
            request_id="synthetic-surprise-question",
        )


async def build() -> None:
    for label in "abc":
        proposal = SurpriseProposal.model_validate(load(
            ROOT / "seed/candidates" / label / "surprise-question-proposal.json"
        ))
        gateway = ModelGateway(
            mode="record",
            configuration=load_models_configuration(),
            providers={Provider.OPENAI: SyntheticProvider(proposal)},
            cassettes=FileCassetteStore(
                ROOT / "fixtures/cassettes", clock=lambda: RECORDED_AT,
            ),
        )
        response = await SurpriseQuestionService(gateway).prepare(seed_request(label))
        if response != SurpriseResult(
            question=proposal.question, competency=proposal.competency,
            why=proposal.why,
        ):
            raise RuntimeError("synthetic surprise-question output changed")
        if label == "a" and response != SurpriseResult.model_validate(
            load(EXAMPLES / "surprise-question.response.json")
        ):
            raise RuntimeError("candidate A differs from the frozen example")


if __name__ == "__main__":
    asyncio.run(build())
