"""Record authored synthetic M1 responses for A/B/C in offline replay.

These are test fixtures, not measured live-model quality or runtime seed lookups.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.gateway.cassettes import FileCassetteStore
from services.ml.app.gateway.config import Provider, load_models_configuration
from services.ml.app.gateway.service import ModelGateway
from services.ml.app.gateway.types import ProviderRequest, ProviderResponse
from services.ml.app.modules.brief import BriefGenerator, BriefService
from services.ml.app.schemas.contracts import BriefRequest, BriefResult
from services.ml.scripts.export_seed import CANDIDATE_IDS


SEED = ROOT / "seed/candidates"
EXAMPLE = ROOT / "docs/contracts/examples/candidate-a/ml/brief.request.json"
CASSETTES = Path(os.environ.get("M1_CASSETTES_DIR", ROOT / "fixtures/cassettes"))
RECORDED_AT = datetime(2026, 9, 24, tzinfo=timezone.utc)


def request_for(candidate: str, *, with_english: bool) -> BriefRequest:
    if candidate == "a":
        raw = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    else:
        snapshot = json.loads((SEED / candidate / "snapshot.json").read_text(encoding="utf-8"))
        raw = {
            "candidate": {
                "candidateId": CANDIDATE_IDS[candidate],
                "application": snapshot["application"],
                "test": snapshot["test"],
                "englishCertificate": snapshot.get("englishCertificate"),
            },
            "simulationEnglish": json.loads(
                (SEED / candidate / "expected-assessment.json").read_text(encoding="utf-8")
            )["english"],
        }
    if not with_english:
        raw["simulationEnglish"] = None
    return BriefRequest.model_validate(raw)


class AuthoredBriefProvider:
    output: BriefResult | None = None

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        del request
        if self.output is None:
            raise RuntimeError("synthetic brief output was not set")
        return ProviderResponse(
            content=self.output.model_dump_json(), input_tokens=140,
            output_tokens=200, request_id="synthetic-m1-brief-fixture",
        )


async def build() -> None:
    provider = AuthoredBriefProvider()
    gateway = ModelGateway(
        mode="record", configuration=load_models_configuration(),
        providers={Provider.OPENAI: provider},
        cassettes=FileCassetteStore(CASSETTES, clock=lambda: RECORDED_AT),
    )
    service = BriefService(BriefGenerator(gateway))
    for candidate in "abc":
        provider.output = BriefResult.model_validate_json(
            (SEED / candidate / "expected-brief.json").read_text(encoding="utf-8")
        )
        for with_english in (True, False):
            request = request_for(candidate, with_english=with_english)
            result = await service.prepare(request)
            if with_english and result != provider.output:
                raise RuntimeError("authored brief differs from grounded seed expectation")


if __name__ == "__main__":
    asyncio.run(build())
