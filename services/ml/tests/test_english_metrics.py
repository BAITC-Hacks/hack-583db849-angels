from services.ml.app.metrics.english import compute_english_metrics
from services.ml.app.schemas.contracts import AssessmentRequest, Turn


class GrammarCount:
    def __init__(self, errors: int) -> None:
        self.errors = errors
        self.text = None

    def count_errors(self, text: str) -> int:
        self.text = text
        return self.errors


def turn(number: int, speaker: str, text: str, start: str, end: str) -> Turn:
    return Turn(
        turnId=f"turn_{number:02d}", speaker=speaker, text=text,
        startedAt=start, endedAt=end,
    )


def request(mode: str = "voice") -> AssessmentRequest:
    return AssessmentRequest(
        candidateId="synthetic", scenarioId="conflict-resolution", mode=mode,
        turns=[
            turn(1, "character", "Um, what do you propose?", "2026-09-25T10:00:00Z", "2026-09-25T10:00:05Z"),
            turn(2, "candidate", "Um I asked each owner to review the timeline and we agreed on the next checkpoint.", "2026-09-25T10:00:05Z", "2026-09-25T10:00:15Z"),
            turn(3, "character", "Then?", "2026-09-25T10:00:15Z", "2026-09-25T10:00:18Z"),
            turn(4, "candidate", "I assigned one owner to each task and checked progress with the team every morning.", "2026-09-25T10:00:18Z", "2026-09-25T10:00:28Z"),
        ],
    )


def test_voice_uses_candidate_timing_words_and_local_grammar_count() -> None:
    checker = GrammarCount(1)
    metrics = compute_english_metrics(request(), checker)
    assert metrics.wordsPerMinute == 93
    assert metrics.fillerRate == 0.0323
    assert metrics.meanTurnLength == 15.5
    assert 0 < metrics.lexicalDiversity <= 1
    assert metrics.grammarErrorsPer100Words == 3.23
    assert metrics.cefrEstimate in {"B1", "B2"}
    assert "what do you propose" not in checker.text
    assert "I assigned one owner" in checker.text


def test_accommodated_text_has_no_speech_metrics() -> None:
    metrics = compute_english_metrics(request("text"), GrammarCount(0))
    assert metrics.wordsPerMinute is None
    assert metrics.fillerRate is None
    assert metrics.meanTurnLength == 15.5
    assert metrics.grammarErrorsPer100Words == 0


def test_missing_grammar_checker_does_not_invent_errors_or_cefr() -> None:
    metrics = compute_english_metrics(request())
    assert metrics.grammarErrorsPer100Words is None
    assert metrics.cefrEstimate is None


def test_zero_duration_does_not_invent_speech_rate() -> None:
    example = request()
    example.turns[1].endedAt = example.turns[1].startedAt
    metrics = compute_english_metrics(example, GrammarCount(0))
    assert metrics.wordsPerMinute is None
    assert metrics.fillerRate is not None


def test_empty_candidate_speech_is_all_null() -> None:
    example = request()
    example.turns = [example.turns[0]]
    assert all(
        value is None
        for value in compute_english_metrics(example, GrammarCount(0)).model_dump().values()
    )


def test_only_english_block_changes_when_grammar_error_count_changes() -> None:
    clean = compute_english_metrics(request(), GrammarCount(0))
    errors = compute_english_metrics(request(), GrammarCount(4))
    assert clean.wordsPerMinute == errors.wordsPerMinute
    assert clean.fillerRate == errors.fillerRate
    assert clean.grammarErrorsPer100Words != errors.grammarErrorsPer100Words
