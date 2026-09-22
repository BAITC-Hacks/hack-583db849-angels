# Internal ML contract — for Beknur (`services/ml`)

What `api` sends to the ML service and what it expects back. It is derived from the screens that already run on scripted previews (see the table in [`api.md`](api.md)), so every field below has a place on a screen.

**How to use this file.** The Pydantic models at the end are ready to copy into `services/ml/app/schemas/`. FastAPI exports them to `services/ml/openapi.json`, and `api` generates its `ai-client` from that file (`docs/SPEC.md`, section 5). Once your exported OpenAPI covers an endpoint, it wins and this file is updated to match.

**Examples.** Every request and response has a JSON file for candidate A in [`examples/candidate-a/ml/`](examples/candidate-a/ml/). They validate against the models below. **Your F0 stubs can return them verbatim**: then `api` and the web can integrate against real HTTP before a single prompt exists. Later they are the `DEMO_MODE` answers and the expected results in `seed/`.

## What unblocks the others, in order

1. **F0 — the stubs.**
   - FastAPI with `GET /internal/v1/health` and the `X-Internal-Token` check;
   - `turn`, `assessment` and `brief` returning the candidate A examples;
   - **`services/ml/openapi.json` committed.**
   
   Nauryzbek generates `ai-client` from that file; without it he writes against guesses.
2. **F0 — the seed.**
   - `seed/candidates/{a,b,c}/` in the layout of `docs/SPEC.md`, section 8. Candidate A's `snapshot.json` is in `examples/candidate-a/`; B and C follow `docs/PLAN.md`, section 6.
   - `config/rubric.drive.json`.
3. **F0 — the gateway,** in `replay` by default.
4. **M2 — the real `turn`:** the scenario engine, director and actor, `config/scenarios/conflict-resolution.json` first.
5. **M3 — the real `assessment`:** the judge, English metrics, candidate feedback.
6. **M1 — the real `brief`.**
7. **M4 — `interview/transcribe` and `interview/draft`.** Transcription reuses the Deepgram path built for M2b.
8. **M5 — `quality-check`,** draft shapes in the examples.

## Endpoints

Every request carries `X-Internal-Token`. Responses are the result object itself; errors use the shape in `docs/SPEC.md`, section 4.

| Method | Path | Request → Response | Example files |
| --- | --- | --- | --- |
| `GET` | `/internal/v1/health` | → `{ "status": "ok" }` | |
| `GET` | `/internal/v1/scenarios` | → `ScenarioBrief[]` | |
| `GET` | `/internal/v1/scenarios/{scenarioId}` | → `ScenarioBrief` | `simulation-created.json` → `scenario` |
| `POST` | `/internal/v1/simulation/turn` | `TurnRequest` → `TurnResult` | `ml/simulation-turn.*` |
| `POST` | `/internal/v1/simulation/assessment` | `AssessmentRequest` → `AssessmentResult` | `ml/simulation-assessment.*` |
| `POST` | `/internal/v1/brief` | `BriefRequest` → `BriefResult` | `ml/brief.*` |
| `POST` | `/internal/v1/interview/transcribe` | `TranscribeRequest` → `TranscribeResult` | `ml/interview-transcribe.*` |
| `POST` | `/internal/v1/interview/draft` | `DraftRequest` → `DraftResult` | `ml/interview-draft.*` |
| `POST` | `/internal/v1/quality-check` | draft, M5 | `quality-check-*.json` |

**The opening line.** `api` calls `simulation/turn` with an empty `turns` list; you return the character's first line.

**Who assigns what.** `api` assigns every `turnId` and stores the turns. You return only the character's text and the director's decision.

## Rules the screens rely on

Each of these is visible on a screen, and a mistake here shows up in the demo.

1. **`score: null` means "not enough verified evidence".** It is never a low score. `confidence` and `rationale` are `null` too. The screens draw null differently from 0 on purpose.
2. **Every quote is verbatim.** Check it with the normalisation in `docs/SPEC.md`, section 7:
   - a quote that fails the check is dropped;
   - a score left with no evidence becomes `null`;
   - more than half dropped → one retry, then an error.
   
   The web checks the same thing in its tests against these examples.
3. **`sourceId` must exist in the request:** a `turnId`, a `fieldId`, an `itemId` or a note id you were sent. The screens link every quote to that source; a missing one is a dead link.
4. **The character says at most 60 words,** stays in the scenario, never grades, never hints at a right answer, and never asks about personal life. The hidden motive in the scenario file never leaves the service: `ScenarioBrief` has only the public fields.
5. **Candidate feedback contains no score, no number and no decision wording.** The web's test rejects any digit and the words score, rank, admit, reject, accept, pass and fail. It is the only text the candidate ever reads.
6. **The draft reads the interview transcript and never sees the interviewer's scores.**
   - Evidence comes only from **candidate** turns (`interview_turn`) or notes. The interviewer's turns are context, not evidence.
   - `DraftRequest` has no field for the scores, and `extra="forbid"` rejects them. A draft that saw them could anchor to them in reverse; the comparison is done after, by the web.
6a. **Transcription goes through the gateway,** like every Deepgram call:
   - speaker diarisation, two speakers, and the one who asks the first question is `interviewer`;
   - the audio is never sent to an LLM — only the resulting text is;
   - `api` deletes the audio once the transcript is stored, so you work from the file reference you were given and keep no copy.
7. **English is separate.**
   - `EnglishMetrics` is computed by code;
   - grammar never moves a D.R.I.V.E. score;
   - in `text` mode `wordsPerMinute` and `fillerRate` are `null` — there was no speech to measure.
8. **Every competency left at `null` gets a live-interview question** in `interviewQuestions`. The report's test expects it.
9. **No personal data.**
   - `CandidateView` has no `profile` and forbids extra fields;
   - `api` has already redacted profile values found inside answers;
   - log `candidateId`, never text you did not need.
10. **Model-written staff text is English for now:** rationales, questions, summaries. Staff screens can switch to Russian, so whether it should follow the staff language is an open question for you (`docs/PLAN.md`, section 15). Quotes stay verbatim either way.

## Models

```python
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Strict(BaseModel):
    """Every schema rejects fields it does not know: a profile field cannot slip through."""

    model_config = ConfigDict(extra="forbid")


Competency = Literal["D", "R", "I", "V", "E"]
Score = Annotated[int, Field(ge=0, le=4)] | None
Confidence = Literal["low", "medium", "high"]
SourceKind = Literal["application_field", "test_item", "simulation_turn", "interview_turn", "interview_note"]
TurnId = Annotated[str, Field(pattern=r"^turn_\d{2,}$")]


# ---- What api sends about a candidate: toLLMView() output, never the snapshot.

class ApplicationAnswer(Strict):
    fieldId: str
    question: str
    answer: str


class TestAnswer(Strict):
    itemId: str
    response: str


class EnglishCertificate(Strict):
    type: str
    score: str


class Answers(Strict):
    answers: list[ApplicationAnswer]


class TestAnswers(Strict):
    answers: list[TestAnswer]


class CandidateView(Strict):
    candidateId: str
    application: Answers
    test: TestAnswers
    englishCertificate: EnglishCertificate | None = None


# ---- Shared output pieces.

class Evidence(Strict):
    source: SourceKind
    sourceId: str
    quote: Annotated[str, Field(min_length=1)]


class DriveScore(Strict):
    competency: Competency
    score: Score
    confidence: Confidence | None
    rationale: str | None
    evidence: list[Evidence]

    @model_validator(mode="after")
    def null_means_insufficient_evidence(self) -> "DriveScore":
        if self.score is None and (self.confidence is not None or self.rationale is not None):
            raise ValueError("a null score has no confidence and no rationale")
        if self.score is not None and (not self.evidence or self.confidence is None):
            raise ValueError("a score needs verified evidence and a confidence")
        return self


class EnglishMetrics(Strict):
    wordsPerMinute: float | None
    fillerRate: float | None
    meanTurnLength: float | None
    lexicalDiversity: float | None
    grammarErrorsPer100Words: float | None
    cefrEstimate: str | None


class Turn(Strict):
    turnId: TurnId
    speaker: Literal["candidate", "character"]
    text: str
    startedAt: str
    endedAt: str


def all_five(scores: list[DriveScore]) -> list[DriveScore]:
    if [score.competency for score in scores] != ["D", "R", "I", "V", "E"]:
        raise ValueError("scores list every competency once, in D R I V E order")
    return scores


# ---- Scenarios (M2).

class Character(Strict):
    name: str
    role: str
    wants: str


class ScenarioBrief(Strict):
    """The public part of a scenario. The hidden motive and the beats stay inside the service."""

    scenarioId: str
    title: str
    situation: str
    yourRole: str
    goal: str
    character: Character
    expectedMinutes: int
    maxCandidateTurns: int


# ---- POST /internal/v1/simulation/turn

class TurnState(Strict):
    beat: str
    candidateTurns: int


class TurnRequest(Strict):
    scenarioId: str
    turns: list[Turn]                      # the whole transcript so far; empty for the opening line
    state: TurnState | None = None


class DirectorDecision(Strict):
    beat: str
    nextBeat: str
    reason: str                            # logged for audit, never shown to the candidate


class TurnResult(Strict):
    text: str
    stage: Literal["opening", "in-progress", "wrapping-up", "finished"]
    ended: bool
    director: DirectorDecision

    @field_validator("text")
    @classmethod
    def at_most_sixty_words(cls, text: str) -> str:
        if len(text.split()) > 60:
            raise ValueError("the character says at most 60 words")
        return text


# ---- POST /internal/v1/simulation/assessment

class AssessmentRequest(Strict):
    candidateId: str
    scenarioId: str
    mode: Literal["text", "voice"]
    turns: list[Turn]


class InterviewQuestion(Strict):
    competency: Competency
    question: str
    reason: str


class CandidateFeedback(Strict):
    """The only text the candidate reads: no score, no number, no decision wording."""

    strengths: list[str]
    growth: list[str]
    nextTime: list[str]


class AssessmentResult(Strict):
    scores: list[DriveScore]
    english: EnglishMetrics
    interviewQuestions: list[InterviewQuestion]
    candidateFeedback: CandidateFeedback

    @field_validator("scores")
    @classmethod
    def every_competency_once(cls, scores: list[DriveScore]) -> list[DriveScore]:
        return all_five(scores)


# ---- POST /internal/v1/brief

class BriefRequest(Strict):
    candidate: CandidateView


class BriefQuestion(Strict):
    competency: Competency
    question: str
    why: str
    evidence: list[Evidence]               # empty when the application is silent — that is why it is asked


class BriefFlag(Strict):
    title: str
    ask: str
    sources: Annotated[list[Evidence], Field(min_length=2, max_length=2)]


class BriefTopic(Strict):
    topic: str
    evidence: list[Evidence]


class CertificateLevel(Strict):
    type: str
    score: str
    cefr: str


class BriefEnglish(Strict):
    certificate: CertificateLevel | None
    writtenCefr: str
    basis: str


class BriefResult(Strict):
    summary: str
    questions: list[BriefQuestion]         # at least one per competency
    flags: list[BriefFlag]
    clarify: list[BriefTopic]
    english: BriefEnglish


# ---- POST /internal/v1/interview/draft

class InterviewNote(Strict):
    id: str
    text: str


class InterviewTurn(Strict):
    turnId: Annotated[str, Field(pattern=r"^iturn_\d{2,}$")]
    speaker: Literal["interviewer", "candidate"]
    text: str
    startSec: float
    endSec: float


class TranscribedTurn(Strict):
    speaker: Literal["interviewer", "candidate"]
    text: str
    startSec: float
    endSec: float


# ---- POST /internal/v1/interview/transcribe

class TranscribeRequest(Strict):
    interviewId: str
    audioRef: str                          # where api put the file; api deletes it afterwards
    language: Literal["en"] = "en"
    speakers: int = 2


class TranscribeResult(Strict):
    turns: list[TranscribedTurn]           # api assigns iturn_ ids when it stores them
    durationSec: float


class DraftRequest(Strict):
    """The transcript and any notes. The interviewer's scores are deliberately absent, and extra fields are refused."""

    candidateId: str
    transcript: list[InterviewTurn]
    notes: list[InterviewNote] = []


class DraftResult(Strict):
    scores: list[DriveScore]               # evidence: candidate interview_turn, or interview_note

    @field_validator("scores")
    @classmethod
    def every_competency_once(cls, scores: list[DriveScore]) -> list[DriveScore]:
        return all_five(scores)
```
