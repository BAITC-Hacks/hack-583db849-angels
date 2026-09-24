"""Evidence-grounded consistency signals shared by M1 and later stages."""

from __future__ import annotations

import re

from ..evidence import candidate_view_sources, verify_evidence
from ..schemas.contracts import (
    BriefRequest,
    Claim,
    ConsistencyItem,
    Evidence,
    Metric,
    Observation,
)


_CEFR = re.compile(r"\b(?:A1|A2|B1|B2|C1|C2)\b", re.IGNORECASE)


def english_claim(request: BriefRequest) -> tuple[str, Evidence] | None:
    """Return an explicit self-rating, never infer one from writing style."""

    for answer in request.candidate.application.answers:
        if answer.fieldId != "english_self":
            continue
        matches = list(_CEFR.finditer(answer.answer))
        levels = {match.group().upper() for match in matches}
        if len(levels) != 1:
            return None
        match = matches[0]
        evidence = Evidence(
            source="application_field",
            sourceId=answer.fieldId,
            quote=match.group(),
        )
        if verify_evidence([evidence], candidate_view_sources(request.candidate))[0]:
            return match.group().upper(), evidence
    return None


def before_consistency(request: BriefRequest) -> list[ConsistencyItem]:
    """Compare an explicit English self-rating with supplied simulation metrics."""

    claim = english_claim(request)
    if claim is None:
        return []
    level, quote = claim
    measured = request.simulationEnglish.cefrEstimate if request.simulationEnglish else None
    metric = (
        Metric(name="cefrEstimate", value=measured, source="simulation")
        if measured is not None
        else None
    )
    status = (
        "unverified" if metric is None
        else "consistent" if level == measured.upper()
        else "discrepancy"
    )
    observation = (
        f"Simulation English was estimated at {measured}."
        if measured is not None
        else "No simulation English estimate is available yet."
    )
    question = "In English, describe a recent project and an unexpected problem you solved."
    return [
        ConsistencyItem(
            itemId="c_01",
            topic="english",
            claim=Claim(text=f"Self-rated English as {level}.", evidence=[quote]),
            observation=Observation(text=observation, evidence=[], metric=metric),
            status=status,
            whatToDo="Ask an unprepared English question and review the evidence together.",
            askInInterview=question,
        )
    ]
