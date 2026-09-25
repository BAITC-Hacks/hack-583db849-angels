"""Turn each story's three reference walkthroughs into quality-bench cases.

For docs/scenarios/NN-<id>.md this writes fixtures/bench/<id>/<strong|medium|
weak>/ with:

- transcript.json — the character's line for each beat, then the candidate's
  line from the walkthrough, with timings a spoken session would have;
- expected-assessment.json — the story's expected score per competency, each
  with a verbatim quote and the story's own reason for it; English measured
  by code; a live-interview question for every competency left without
  evidence; candidate feedback in the safe wording the service uses.

The bench then asks the judge for its own report on the same transcript and
keeps a scenario a draft unless all three land within ±1 of these, quoting
verbatim.

    python services/ml/scripts/bench_cases_from_stories.py
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.ml.app.metrics.english import compute_english_metrics
from services.ml.app.modules.assessment_text import ensure_safe_feedback
from services.ml.app.schemas.contracts import AssessmentRequest, AssessmentResult, CandidateFeedback, Turn


STORIES = ROOT / "docs" / "scenarios"
BENCH = ROOT / "fixtures" / "bench"
RUBRIC = ROOT / "config" / "rubric.drive.json"
LEVELS = {"Strong": "strong", "Medium": "medium", "Weak": "weak"}
STOPWORDS = set(
    "a an and the to of in on for with at by from it its is are be as or that this they them their "
    "you your we our he she his her i me my not no but so if then than when what who how why all "
    "about into out up down over after before first only just even".split()
)

# Candidate feedback in the service's own register: what went well, what to grow, what to try.
STRENGTH = {
    "D": "When the plan broke, you looked for the next step instead of stopping.",
    "R": "You suggested something new and said what could go wrong with it.",
    "I": "You looked past the first problem to what the people involved really needed.",
    "V": "You were honest and fair with the people involved, even when it was hard.",
    "E": "You turned the discussion into steps: who does what, and by when.",
}
GROWTH = {
    "D": "When something goes wrong, name the next step and who takes it before deciding to stop.",
    "R": "When you suggest a change, say what could go wrong and how you would keep it small.",
    "I": "Before deciding, ask what the other person needs and what the team is trying to achieve.",
    "V": "Explain your decisions openly, especially to the people they affect.",
    "E": "End with a plan: what happens next, who owns it, and when you will check on it.",
}
NEXT_TIME = {
    "D": "Next time a plan breaks, pause, name one recovery step, and ask who can help.",
    "R": "Next time you propose something, add one sentence on the risk and how to limit it.",
    "I": "Next time, ask one question about the goal behind the problem before you answer.",
    "V": "Next time, tell the people affected what you decided and why, in your own words.",
    "E": "Next time, close the conversation with owners and a date for every step.",
}


class StoryError(ValueError):
    pass


def _words(text: str) -> set[str]:
    """Content words, cut to a five-letter stem so 'corrects' meets 'correction' and 'pupils'' meets 'pupils'."""
    words = (word.strip("'") for word in re.findall(r"[a-z']+", text.lower()))
    return {word[:5] for word in words if word not in STOPWORDS and len(word) > 2}


def _beats(text: str) -> dict[str, dict[str, object]]:
    beats = {}
    section = text[text.index("## Beats"):text.index("## Reference walkthroughs")]
    for block in re.split(r"^### ", section, flags=re.M)[1:]:
        heading = re.match(r"\d+ · `([a-z_]+)`", block)
        shows = re.search(r"\*\*Shows:\*\* ([A-Z, ]+) ·", block)
        line = re.search(r'^\*\*[^*]+:\*\* "(.+)"$', block, re.M)
        if not heading or not shows or not line:
            raise StoryError(f"a beat is missing its heading, Shows line or character line: {block[:60]!r}")
        beats[heading.group(1)] = {
            "line": line.group(1),
            "competencies": [code.strip() for code in shows.group(1).split(",")],
            # What each kind of answer means, in the story's words: the best clue to which line carries a reason.
            "kinds": dict(re.findall(r"^- \*\*`([a-z_]+)`\*\* → `[a-z_]+` — (.+)$", block, re.M)),
        }
    return beats


def _walkthroughs(text: str) -> list[dict[str, object]]:
    section = text[text.index("## Reference walkthroughs"):]
    cases = []
    for block in re.split(r"^### ", section, flags=re.M)[1:]:
        level = block.split(" ", 1)[0]
        if level not in LEVELS:
            continue
        rows = re.findall(r'^\| \d+ \| `([a-z_]+)` \| `([a-z_]+)` \| "(.+)" \|$', block, re.M)
        expected = re.search(r"^\*\*Expected:\*\* (.+)$", block, re.M)
        why = re.search(r"^\*\*Why:\*\* (.+)$", block, re.M)
        if not rows or not expected or not why:
            raise StoryError(f"the {level} walkthrough is incomplete")
        scores = {}
        for code, value in re.findall(r"([DRIVE]) (\d|not enough evidence)", expected.group(1)):
            scores[code] = None if value == "not enough evidence" else int(value)
        if list(scores) != list("DRIVE"):
            raise StoryError(f"the {level} walkthrough does not score all five competencies in order")
        reasons: dict[str, list[str]] = {code: [] for code in "DRIVE"}
        for clause, codes in re.findall(r"([^,;()]+?)\s*\(([DRIVE](?:, [DRIVE])*)\)", why.group(1)):
            clause = re.sub(r"^(?:and|but|then)\s+", "", clause.strip())
            for code in codes.split(", "):
                reasons[code].append(clause)
        cases.append({"level": LEVELS[level], "rows": rows, "scores": scores, "reasons": reasons})
    if [case["level"] for case in cases] != ["strong", "medium", "weak"]:
        raise StoryError("a story needs a strong, a medium and a weak walkthrough")
    return cases


def _transcript(beats: dict[str, dict[str, object]], rows: list[tuple[str, str, str]]) -> list[Turn]:
    clock = datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc)
    turns: list[Turn] = []

    def add(speaker: str, text: str, seconds: float) -> None:
        nonlocal clock
        start, end = clock, clock + timedelta(seconds=round(seconds))
        turns.append(Turn(
            turnId=f"turn_{len(turns) + 1:02d}", speaker=speaker, text=text,
            startedAt=start.isoformat().replace("+00:00", "Z"), endedAt=end.isoformat().replace("+00:00", "Z"),
        ))
        clock = end + timedelta(seconds=6)

    for beat, _kind, says in rows:
        if beat not in beats:
            raise StoryError(f"the walkthrough names an unknown beat '{beat}'")
        line = str(beats[beat]["line"])
        add("character", line, max(4, len(line.split()) / 2.6))
        # Around 120 words a minute, a comfortable spoken pace.
        add("candidate", says, max(3, len(says.split()) / 2.0))
    return turns


def _best_quote(
    code: str, reasons: list[str], turns: list[Turn], shows: dict[str, list[str]], context: dict[str, set[str]],
) -> tuple[Turn, str]:
    """The candidate sentence that best carries the story's reason.

    A line counts for what it says, for the kind of answer the story names it
    (`see_the_harm`) with that kind's description, and for whether its beat
    lets this competency show. The quote itself is always the candidate's own
    sentence, verbatim.
    """
    wanted = set().union(*(_words(reason) for reason in reasons)) if reasons else set()
    best: tuple[float, Turn, str] | None = None
    for turn in turns:
        if turn.speaker != "candidate":
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", turn.text):
            if not sentence.strip():
                continue
            said = _words(sentence)
            # The sentence's own words count double; a fuller sentence wins a tie over a short aside.
            weight = 2 * len(wanted & said) + len(wanted & context[turn.turnId]) + (1.5 if code in shows[turn.turnId] else 0) + 0.05 * min(len(said), 12)
            if best is None or weight > best[0]:
                best = (weight, turn, sentence.strip())
    if best is None:
        raise StoryError("a walkthrough has no candidate line to quote")
    return best[1], best[2]


def build_case(story: Path, case: dict[str, object], beats: dict[str, dict[str, object]], scenario_id: str) -> tuple[list[Turn], AssessmentResult]:
    rubric = {item["code"]: item for item in json.loads(RUBRIC.read_text(encoding="utf-8"))["competencies"]}
    rows = case["rows"]
    turns = _transcript(beats, rows)
    # Which competencies each candidate turn's beat lets the candidate show.
    shows = {turns[index * 2 + 1].turnId: list(beats[row[0]]["competencies"]) for index, row in enumerate(rows)}
    context = {
        turns[index * 2 + 1].turnId: _words(row[1].replace("_", " ") + " " + beats[row[0]]["kinds"].get(row[1], ""))
        for index, row in enumerate(rows)
    }
    scores, questions = [], []
    for code in "DRIVE":
        score = case["scores"][code]
        reasons = case["reasons"][code]
        if score is None:
            scores.append({"competency": code, "score": None, "confidence": None, "rationale": None, "evidence": []})
            questions.append({
                "competency": code,
                "question": rubric[code]["interview_question_templates"][0],
                "reason": f"No verified evidence for {rubric[code]['name']} in the simulation.",
            })
            continue
        turn, quote = _best_quote(code, reasons, turns, shows, context)
        rationale = "; ".join(reasons) if reasons else f"The cited turn is the clearest {rubric[code]['name']} moment"
        scores.append({
            "competency": code,
            "score": score,
            "confidence": "high" if score in (0, 4) else "medium",
            "rationale": rationale[0].upper() + rationale[1:] + ".",
            "evidence": [{"source": "simulation_turn", "sourceId": turn.turnId, "quote": quote}],
        })
        if score <= 1:
            questions.append({
                "competency": code,
                "question": rubric[code]["interview_question_templates"][0],
                "reason": f"The simulation shows little {rubric[code]['name']}; ask for an example from the candidate's own life.",
            })

    known = [(code, case["scores"][code]) for code in "DRIVE" if case["scores"][code] is not None]
    strong = [code for code, value in sorted(known, key=lambda item: -item[1]) if value >= 3][:3]
    weak = [code for code, value in sorted(known, key=lambda item: item[1]) if value <= 2][:2]
    weak += [code for code in "DRIVE" if case["scores"][code] is None][: 2 - len(weak)]
    feedback = CandidateFeedback(
        strengths=[STRENGTH[code] for code in strong] or ["You stayed in the conversation to the end and answered every turn."],
        growth=[GROWTH[code] for code in weak] or [GROWTH["R"]],
        nextTime=[NEXT_TIME[code] for code in (weak or ["R"])],
    )
    ensure_safe_feedback(feedback)
    request = AssessmentRequest(candidateId=f"synthetic-{case['level']}", scenarioId=scenario_id, mode="voice", turns=turns)
    result = AssessmentResult(
        scores=scores,
        english=compute_english_metrics(request),
        interviewQuestions=questions,
        candidateFeedback=feedback,
    )
    return turns, result


def main() -> None:
    for story in sorted(STORIES.glob("[0-9][0-9]-*.md")):
        scenario_id = re.sub(r"^\d+-", "", story.stem)
        text = story.read_text(encoding="utf-8")
        beats = _beats(text)
        for case in _walkthroughs(text):
            turns, result = build_case(story, case, beats, scenario_id)
            target = BENCH / scenario_id / str(case["level"])
            target.mkdir(parents=True, exist_ok=True)
            (target / "transcript.json").write_text(
                json.dumps([turn.model_dump(mode="json") for turn in turns], indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
            )
            (target / "expected-assessment.json").write_text(
                json.dumps(result.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n", encoding="utf-8",
            )
            summary = " ".join(f"{score.competency}{'·' if score.score is None else score.score}" for score in result.scores)
            print(f"{target.relative_to(ROOT)}: {len(turns)} turns, {summary}")


if __name__ == "__main__":
    main()
