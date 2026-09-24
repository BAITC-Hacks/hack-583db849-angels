"""Reusable verification of model-provided quotes against supplied source text."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Iterable, Mapping

from services.ml.app.schemas.contracts import DriveScore, Evidence, Turn


logger = logging.getLogger(__name__)
SourceKey = tuple[str, str]
_QUOTE_TRANSLATION = str.maketrans({
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
})


def normalize_quote(text: str) -> str:
    """Apply only the whitespace and curly-quote rules in SPEC section 7."""

    return " ".join(text.translate(_QUOTE_TRANSLATION).split())


def candidate_turn_sources(turns: Iterable[Turn]) -> dict[SourceKey, str]:
    """Keep character speech available as context, never as score evidence."""

    return {
        ("simulation_turn", turn.turnId): turn.text
        for turn in turns
        if turn.speaker == "candidate"
    }


@dataclass(frozen=True)
class Verification:
    scores: tuple[DriveScore, ...]
    submitted: int
    dropped: int

    @property
    def majority_dropped(self) -> bool:
        return self.submitted > 0 and self.dropped * 2 > self.submitted


def verify_evidence(
    evidence: Iterable[Evidence],
    sources: Mapping[SourceKey, str],
) -> tuple[list[Evidence], int, int]:
    """Discard unsupported quotes without modifying accepted verbatim text."""

    accepted: list[Evidence] = []
    submitted = 0
    dropped = 0
    for item in evidence:
        submitted += 1
        source_text = sources.get((item.source, item.sourceId))
        if source_text is None or normalize_quote(item.quote) not in normalize_quote(source_text):
            dropped += 1
            logger.warning(
                "evidence_quote_dropped source=%s source_id=%s",
                item.source,
                item.sourceId,
            )
            continue
        accepted.append(item)
    return accepted, submitted, dropped


def verify_scores(
    scores: Iterable[DriveScore],
    sources: Mapping[SourceKey, str],
) -> Verification:
    """Null unsupported scores; report aggregate loss for the caller's retry rule."""

    verified: list[DriveScore] = []
    total_submitted = 0
    total_dropped = 0
    for score in scores:
        evidence, submitted, dropped = verify_evidence(score.evidence, sources)
        total_submitted += submitted
        total_dropped += dropped
        if score.score is not None and not evidence:
            verified.append(
                DriveScore(
                    competency=score.competency,
                    score=None,
                    confidence=None,
                    rationale=None,
                    evidence=[],
                )
            )
            continue
        verified.append(score.model_copy(update={"evidence": evidence}))
    return Verification(tuple(verified), total_submitted, total_dropped)
