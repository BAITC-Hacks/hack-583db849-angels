"""Check six synthetic M1 briefs through the real internal HTTP route."""

from __future__ import annotations

import argparse
import json
import os
from typing import Any

from services.ml.app.evidence import candidate_view_sources, verify_evidence
from services.ml.app.schemas.contracts import BriefResult
from services.ml.scripts.build_m1_cassettes import request_for
from services.ml.scripts.smoke_m2a import HttpTransport, Transport


FOCUSES = {"D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"}


def run(transport: Transport) -> dict[str, Any]:
    cases = []
    for candidate in "abc":
        for with_english in (True, False):
            request = request_for(candidate, with_english=with_english)
            status, _, raw, _ = transport.request(
                "POST", "/internal/v1/brief", payload=request.model_dump(mode="json"),
            )
            if status != 200:
                raise RuntimeError(f"M1 replay failed for case {candidate}: HTTP {status}")
            result = BriefResult.model_validate_json(raw)
            if {item.focus for item in result.questions} != FOCUSES:
                raise RuntimeError("M1 brief did not ask every focus")
            motivation = next(item for item in result.questions if item.focus == "motivation")
            if (
                "programme supports your goals" not in motivation.question
                or "free tuition factor" not in motivation.question
            ):
                raise RuntimeError("M1 motivation question does not explore fit and cost")
            sources = candidate_view_sources(request.candidate)
            evidence = [piece for item in result.questions for piece in item.evidence]
            evidence.extend(piece for item in result.clarify for piece in item.evidence)
            for item in result.consistency:
                evidence.extend(item.claim.evidence)
                evidence.extend(item.observation.evidence)
                metric = item.observation.metric
                if metric is not None:
                    actual = (
                        getattr(request.simulationEnglish, metric.name)
                        if request.simulationEnglish is not None else None
                    )
                    if metric.source != "simulation" or str(actual) != str(metric.value):
                        raise RuntimeError("M1 brief returned an unsupported metric")
            accepted, _, dropped = verify_evidence(evidence, sources)
            if dropped or len(accepted) != len(evidence):
                raise RuntimeError("M1 brief returned an unsupported quote")
            if candidate == "a" and with_english:
                english = result.consistency[0]
                if (
                    english.status != "discrepancy"
                    or english.claim.evidence[0].quote != "C2"
                    or english.observation.metric is None
                    or english.observation.metric.value != "B2"
                    or not english.askInInterview
                ):
                    raise RuntimeError("A's C2/B2 follow-up is missing")
            if not with_english and any(
                item.observation.metric is not None for item in result.consistency
            ):
                raise RuntimeError("M1 brief invented a simulation measurement")
            cases.append({
                "candidate": candidate,
                "simulationEnglish": with_english,
                "questions": len(result.questions),
                "quotesChecked": len(evidence),
            })
    return {"mode": "replay", "cases": cases, "requests": len(cases)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    options = parser.parse_args()
    token = os.environ.get("ML_INTERNAL_TOKEN")
    if not token:
        raise SystemExit("ML_INTERNAL_TOKEN is required")
    print(json.dumps(run(HttpTransport(options.base_url, token)), sort_keys=True))
