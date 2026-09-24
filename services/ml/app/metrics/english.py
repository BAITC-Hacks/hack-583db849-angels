"""Deterministic English measurements, separate from leadership judging."""

from __future__ import annotations

from datetime import datetime
import re
from typing import Protocol

from ..schemas.contracts import AssessmentRequest, EnglishMetrics, Turn


_WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
_FILLERS = frozenset({"uh", "um", "erm", "er"})


class GrammarChecker(Protocol):
    def count_errors(self, text: str) -> int: ...


def _duration_seconds(turn: Turn) -> float | None:
    try:
        start = datetime.fromisoformat(turn.startedAt.replace("Z", "+00:00"))
        end = datetime.fromisoformat(turn.endedAt.replace("Z", "+00:00"))
        elapsed = (end - start).total_seconds()
    except (ValueError, TypeError):
        return None
    return elapsed if elapsed > 0 else None


def _cefr_estimate(
    word_count: int,
    mean_turn_length: float,
    lexical_diversity: float,
    grammar_errors_per_100_words: float | None,
) -> str | None:
    """Conservative heuristic, not a certified language-level assessment."""

    if word_count < 20 or grammar_errors_per_100_words is None:
        return None
    if (
        mean_turn_length >= 25
        and lexical_diversity >= 0.70
        and grammar_errors_per_100_words <= 1
    ):
        return "C1"
    if (
        mean_turn_length >= 15
        and lexical_diversity >= 0.55
        and grammar_errors_per_100_words <= 4
    ):
        return "B2"
    if mean_turn_length >= 10 and grammar_errors_per_100_words <= 8:
        return "B1"
    return "A2"


def compute_english_metrics(
    request: AssessmentRequest,
    grammar_checker: GrammarChecker | None = None,
) -> EnglishMetrics:
    candidate_turns = [turn for turn in request.turns if turn.speaker == "candidate"]
    words = [
        word.casefold()
        for turn in candidate_turns
        for word in _WORD.findall(turn.text)
    ]
    word_count = len(words)
    if not word_count:
        return EnglishMetrics(
            wordsPerMinute=None, fillerRate=None, meanTurnLength=None,
            lexicalDiversity=None, grammarErrorsPer100Words=None,
            cefrEstimate=None,
        )

    mean_turn_length = word_count / len(candidate_turns)
    lexical_diversity = len(set(words)) / word_count
    speech_seconds = [_duration_seconds(turn) for turn in candidate_turns]
    total_speech_seconds = sum(item for item in speech_seconds if item is not None)
    complete_timing = all(item is not None for item in speech_seconds)
    words_per_minute = (
        word_count * 60 / total_speech_seconds
        if request.mode == "voice" and complete_timing and total_speech_seconds > 0
        else None
    )
    filler_rate = (
        sum(word in _FILLERS for word in words) / word_count
        if request.mode == "voice"
        else None
    )
    grammar_errors = (
        grammar_checker.count_errors("\n".join(turn.text for turn in candidate_turns))
        if grammar_checker is not None
        else None
    )
    if grammar_errors is not None and grammar_errors < 0:
        raise ValueError("grammar checker returned a negative error count")
    grammar_rate = grammar_errors * 100 / word_count if grammar_errors is not None else None
    return EnglishMetrics(
        wordsPerMinute=round(words_per_minute, 2) if words_per_minute is not None else None,
        fillerRate=round(filler_rate, 4) if filler_rate is not None else None,
        meanTurnLength=round(mean_turn_length, 2),
        lexicalDiversity=round(lexical_diversity, 4),
        grammarErrorsPer100Words=round(grammar_rate, 2) if grammar_rate is not None else None,
        cefrEstimate=_cefr_estimate(
            word_count, mean_turn_length, lexical_diversity, grammar_rate,
        ),
    )
