"""Evidence-grounded consistency signals shared by M1 and later stages."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable

from ..evidence import candidate_view_sources, verify_evidence
from ..metrics.certificate import mapped_certificate_cefr
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
        if (
            "english" not in answer.fieldId.lower()
            and "english" not in answer.question.lower()
        ):
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
    certificate = request.candidate.englishCertificate
    if certificate is not None:
        mapped = mapped_certificate_cefr(certificate.type, certificate.score)
        if mapped is not None:
            observation += (
                f" The supplied IELTS overall band indicatively maps to {mapped}; "
                "the certificate has not been verified."
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


def assemble_before_consistency(
    request: BriefRequest,
    proposed: Iterable[ConsistencyItem],
    checked: Callable[[Iterable[Evidence]], list[Evidence]],
) -> list[ConsistencyItem]:
    """Assemble the same grounded before items for M1 and standalone C."""

    items = before_consistency(request)
    for proposed_item in proposed:
        claim_evidence = checked(proposed_item.claim.evidence)
        observation_evidence = checked(proposed_item.observation.evidence)
        if proposed_item.topic == "english" or not claim_evidence:
            continue  # English is measured deterministically above.
        if proposed_item.observation.metric is not None:
            # A model may not invent a measurement for another topic.
            continue
        observation_text = (
            f"The cited test or application response is: {observation_evidence[0].quote}"
            if observation_evidence else "No comparable observation was supplied."
        )
        items.append(ConsistencyItem(
            itemId=f"c_{len(items) + 1:02d}",
            topic=proposed_item.topic,
            claim=Claim(
                text=f"The cited response says: {claim_evidence[0].quote}",
                evidence=claim_evidence,
            ),
            observation=Observation(
                text=observation_text,
                evidence=observation_evidence,
                metric=None,
            ),
            # Verified quotes establish source text, not semantic agreement.
            status="unverified",
            whatToDo="Ask the candidate to clarify these points with a concrete example.",
            askInInterview="How do these two points fit together in a recent example?",
        ))
    return items
