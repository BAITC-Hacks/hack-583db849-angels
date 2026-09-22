# Internal ML contract — for Nauryzbek (`services/ml`)

What `api` sends to the ML service and what it expects back. It is derived from the screens that already run on scripted previews (see the table in [`api.md`](api.md)), so every field below has a place on a screen.

**How to use this file.** The Pydantic models at the end are ready to copy into `services/ml/app/schemas/`. FastAPI exports them to `services/ml/openapi.json`, and `api` generates its `ai-client` from that file (`docs/SPEC.md`, section 5). The shapes here are frozen: your exported OpenAPI must match them field for field. A shape that looks wrong is raised in your issue, and Meiyrbek changes this file first, only by adding.

**Examples.** Every request and response has a JSON file for candidate A in [`examples/candidate-a/ml/`](examples/candidate-a/ml/). They validate against the models below. **Your F0 stubs can return them verbatim**: then `api` and the web can integrate against real HTTP before a single prompt exists. Later they are the `DEMO_MODE` answers and the expected results in `seed/`.

## What unblocks the others, in order

1. **F0 — the stubs.**
   - FastAPI with `GET /internal/v1/health` and the `X-Internal-Token` check;
   - **every endpoint in the table below** returning its candidate A example, so `api` never waits for a later ML slice;
   - **`services/ml/openapi.json` committed.**
   
   Aibek generates `ai-client` from that file; without it the API is written against guesses.
2. **F0 — the seed.**
   - `seed/candidates/{a,b,c}/` in the layout of `docs/SPEC.md`, section 8. Candidate A's `snapshot.json` is in `examples/candidate-a/`; B and C follow `docs/PLAN.md`, section 6.
   - `config/rubric.drive.json`.
3. **F0 — the gateway,** in `replay` by default.
4. **M2 — the real `turn`, by voice:** Deepgram transcription and voice through the gateway, the mini-ML matcher, the scenario engine and the actor, with the first scenario in `config/scenarios/`. Voice is the input now, so this is on the critical path.
5. **M3 — the real `assessment`:** the judge, English metrics, candidate feedback.
6. **M1 — the real `brief`.**
7. **M4 — `transcribe` and `interview/draft`.** One transcription endpoint serves the interview (two speakers), the surprise answer and voice turns (one speaker).
8. **Admin — `GET /internal/v1/usage`:** live and replayed calls and spend, from the gateway's cost log.
9. **M5 — `quality-check`:** leading and off-limits questions from an interview transcript, and an interviewer's drift against the panel from a pseudonymous score history.
10. **M2b — scenarios 2–10**, each through the quality bench before it becomes `ready`; **C — `consistency`**; **S — `surprise-question`.**

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
| `POST` | `/internal/v1/transcribe` | `TranscribeRequest` → `TranscribeResult` | `ml/transcribe.*` |
| `POST` | `/internal/v1/speech` | `SpeechRequest` → `audio/mpeg` | |
| `POST` | `/internal/v1/consistency` | `ConsistencyRequest` → `ConsistencyResult` (C) | `ml/consistency-*.json` |
| `POST` | `/internal/v1/surprise-question` | `SurpriseRequest` → `SurpriseResult` (S) | `ml/surprise-question.*` |
| `GET` | `/internal/v1/usage` | → `Usage` | `ml/usage.response.json` |
| `POST` | `/internal/v1/interview/draft` | `DraftRequest` → `DraftResult` | `ml/interview-draft.*` |
| `POST` | `/internal/v1/quality-check` | `QualityCheckRequest` → `QualityCheckResult` (M5) | `ml/quality-check-*.json` |

**Consistency, two stages.** `api` calls `consistency` only with `stage: "after"`. The before stage comes inside `brief` as `BriefResult.consistency` — write it once, as one module, and use it in both.

**Audio files.** `audioRef` is a path relative to `UPLOADS_DIR`, a volume `api` and `ml` both mount (`docs/SPEC.md`, section 3). Read the file from there and keep no copy.

**The opening line.** `api` calls `simulation/turn` with an empty `turns` list; you return the character's first line.

**Who assigns what.** `api` assigns every `turnId` and stores the turns, and picks the scenario from `GET /internal/v1/scenarios` (only `ready` ones). You return only the character's text and the director's decision.

**How a turn is decided — the mini-ML.** The turn's text is already transcribed. You:
1. embed it with a local sentence-embedding model (for example `all-MiniLM-L6-v2`, baked into the image, $0);
2. compare it with the example phrases of each answer type in the current beat of `config/scenarios/<id>.json`;
3. take the best type above the scenario's `matchThreshold`, else the beat's `fallback`;
4. move to that branch's next beat and let the actor (OpenAI) write the character's line for its `characterIntent`.

The matched type, its similarity and the branch go into `DirectorDecision` — logged, never shown to the candidate. **The matcher only steers the story; it never scores.** Every branch lets the candidate show all five competencies.

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
   - for an interview (`speakers: 2`) the speaker who asks the first question is `interviewer`; for a surprise answer or a voice turn (`speakers: 1`) every turn is `candidate`;
   - the audio is never sent to an LLM — only the resulting text is. For the surprise answer you receive the audio track only, never the video;
   - `api` deletes the audio once the transcript is stored, so you work from the file reference you were given and keep no copy.
6b. **The surprise question** is about the candidate's own application, answerable in 90 seconds without preparation, in plain English, and never touches personal life, family, health, money or anything on the `profile` list. You return the competency it targets and why — staff see them, the candidate never does.
7. **English is separate.**
   - `EnglishMetrics` is computed by code;
   - grammar never moves a D.R.I.V.E. score;
   - the simulation is spoken, so every measure exists; only an accommodated text simulation has `wordsPerMinute` and `fillerRate` as `null`.
7a. **Consistency compares, it does not judge.** Each item pairs what the candidate claimed (with its quote) with what was observed (a quote or a measured value, such as `cefrEstimate: "B2"` from the simulation), gives a status and a recommendation for people. It never says anything about admitting anyone. `after` reads the interview transcript and is only requested once the interviewer's scores are saved.
7b. **The brief covers three topics beyond D.R.I.V.E.:** what the candidate knows about inVision U, how good their English is, and whether the motivation is serious. At least one question per focus.
8. **Every competency left at `null` gets a live-interview question** in `interviewQuestions`. The report's test expects it.
9. **No personal data.**
   - `CandidateView` has no `profile` and forbids extra fields;
   - `api` has already redacted profile values found inside answers;
   - log `candidateId`, never text you did not need.
9a. **The quality check is about the process, never the candidate.**
   - For an interview you receive the transcript. Examine the **interviewer's** turns: a question that suggests its own answer, a question that may not be asked at all (family, money, health, background), and which competencies never came up. Every such signal quotes the question verbatim, like any other evidence.
   - A candidate's turn is context. Nothing you return may describe, score or explain a candidate — the screens show these signals to a panel about their own work.
   - For a calibration you receive saved scores with pseudonymous references and no candidate data at all. `drift` and `talkShare` are arithmetic: compute them in code, and let the model write only the message and the recommendation.
   - A recommendation says what a person could do next — re-ask openly, drop the question, calibrate two scores against the rubric. It never says what to decide about anyone.
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
SourceKind = Literal["application_field", "test_item", "simulation_turn", "interview_turn", "interview_note", "surprise_answer"]
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


class AnswerType(Strict):
    """One kind of answer the candidate may give in a beat, recognised by the mini-ML from its examples."""

    answerTypeId: str
    description: str
    examples: Annotated[list[str], Field(min_length=3)]
    next: str                              # the beat this branch leads to, or "end"
    characterIntent: str                   # what the actor should do in this branch


class Beat(Strict):
    beatId: str
    goal: str
    competencies: list[Competency]
    answerTypes: Annotated[list[AnswerType], Field(min_length=3, max_length=5)]
    fallback: AnswerType                   # below the threshold
    maxTurns: int


class ScenarioConfig(Strict):
    """config/scenarios/<id>.json. Only the public fields leave the service, as ScenarioBrief."""

    scenarioId: str
    status: Literal["draft", "ready"]      # ready only after the quality bench
    title: str
    situation: str
    yourRole: str
    goal: str
    character: Character
    hiddenMotive: str
    voice: str
    matchThreshold: Annotated[float, Field(ge=0, le=1)]
    expectedMinutes: int
    maxCandidateTurns: int
    beats: Annotated[list[Beat], Field(min_length=5, max_length=7)]

    @model_validator(mode="after")
    def every_competency_can_show(self) -> "ScenarioConfig":
        if {c for beat in self.beats for c in beat.competencies} != {"D", "R", "I", "V", "E"}:
            raise ValueError("a scenario lets the candidate show all five competencies")
        return self


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
    status: Literal["draft", "ready"]


# ---- POST /internal/v1/simulation/turn

class TurnState(Strict):
    beat: str
    candidateTurns: int


class TurnRequest(Strict):
    scenarioId: str
    turns: list[Turn]                      # the whole transcript so far; empty for the opening line
    state: TurnState | None = None


class DirectorDecision(Strict):
    """Logged for audit, never shown to the candidate."""

    beat: str
    matchedAnswerType: str                 # the fallback's id when nothing matched
    similarity: Annotated[float, Field(ge=-1, le=1)] | None   # None for the opening line
    nextBeat: str
    reason: str


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
    mode: Literal["voice", "text"]         # text only with an accommodation
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
    simulationEnglish: EnglishMetrics | None = None     # once the simulation is assessed


BriefFocus = Literal["D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"]


class BriefQuestion(Strict):
    focus: BriefFocus
    question: str
    why: str
    evidence: list[Evidence]               # empty when the application is silent — that is why it is asked


ConsistencyTopic = Literal["english", "invision_knowledge", "motivation", "experience", "achievements", "other"]


class Claim(Strict):
    text: str
    evidence: list[Evidence]


class Metric(Strict):
    name: Literal["wordsPerMinute", "fillerRate", "meanTurnLength", "lexicalDiversity", "grammarErrorsPer100Words", "cefrEstimate"]
    value: str | float
    source: Literal["simulation", "surprise", "interview"]


class Observation(Strict):
    text: str
    evidence: list[Evidence]
    metric: Metric | None


class ConsistencyItem(Strict):
    itemId: str
    topic: ConsistencyTopic
    claim: Claim
    observation: Observation
    status: Literal["consistent", "discrepancy", "unverified", "confirmed", "resolved"]
    whatToDo: str                          # a recommendation for people, never a decision
    askInInterview: str | None             # before the interview only


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
    questions: list[BriefQuestion]         # at least one per focus
    consistency: list[ConsistencyItem]     # the before stage
    clarify: list[BriefTopic]
    english: BriefEnglish

    @field_validator("questions")
    @classmethod
    def every_focus_asked(cls, questions: list[BriefQuestion]) -> list[BriefQuestion]:
        needed = {"D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"}
        if not needed <= {q.focus for q in questions}:
            raise ValueError("the brief asks at least one question per focus")
        return questions


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


# ---- POST /internal/v1/transcribe

class TranscribeRequest(Strict):
    purpose: Literal["interview", "surprise", "turn"]
    audioRef: str                          # where api put the file; api deletes it afterwards
    language: Literal["en"] = "en"
    speakers: Literal[1, 2] = 2


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


# ---- POST /internal/v1/consistency (C)

class ConsistencyRequest(Strict):
    stage: Literal["before", "after"]
    candidate: CandidateView
    simulationEnglish: EnglishMetrics | None = None
    simulationTurns: list[Turn] = []
    interviewTranscript: list[InterviewTurn] = []   # after only; never the interviewer's scores


class ConsistencyResult(Strict):
    items: list[ConsistencyItem]


# ---- POST /internal/v1/speech

class SpeechRequest(Strict):
    text: str
    voice: str                             # from the scenario's character


# ---- POST /internal/v1/surprise-question (S)

class SurpriseRequest(Strict):
    candidate: CandidateView


class SurpriseResult(Strict):
    question: str
    competency: Competency
    why: str                               # for staff only

    @field_validator("question")
    @classmethod
    def short_enough_to_answer(cls, question: str) -> str:
        if len(question.split()) > 40:
            raise ValueError("a surprise question is at most 40 words")
        return question



# ---- POST /internal/v1/quality-check (M5)

SignalKind = Literal["leading_question", "off_limits_question", "coverage_gap", "scale_drift"]


class ScoreValue(Strict):
    competency: Competency
    score: Score


class ScoredInterview(Strict):
    """One saved set of scores, pseudonymous: no candidate, no names."""

    interviewRef: str
    interviewerRef: str
    heldAt: str
    scores: list[ScoreValue]


class QualityCheckRequest(Strict):
    kind: Literal["interview", "calibration"]
    transcript: list[InterviewTurn] = []      # interview only
    history: list[ScoredInterview] = []       # calibration only, the whole panel over the period
    interviewerRef: str | None = None
    periodFrom: str | None = None
    periodTo: str | None = None

    @model_validator(mode="after")
    def one_kind_of_input(self) -> "QualityCheckRequest":
        if self.kind == "interview" and (not self.transcript or self.history):
            raise ValueError("an interview check reads a transcript and nothing else")
        if self.kind == "calibration" and (not self.history or self.transcript or not self.interviewerRef):
            raise ValueError("a calibration check reads a history and needs an interviewerRef")
        return self


class QualitySignal(Strict):
    kind: SignalKind
    message: str
    recommendation: str
    competencies: list[Competency] = []
    evidence: list[Evidence] = []             # interviewer turns, verbatim

    @model_validator(mode="after")
    def a_question_signal_quotes_the_question(self) -> "QualitySignal":
        if self.kind in ("leading_question", "off_limits_question") and not self.evidence:
            raise ValueError("a signal about a question quotes that question")
        if self.kind == "scale_drift" and not self.competencies:
            raise ValueError("drift names the competency it drifted on")
        return self


class TalkShare(Strict):
    interviewer: float
    candidate: float


class Drift(Strict):
    competency: Competency
    interviewerMean: float
    panelMean: float
    delta: float


class QualityCheckResult(Strict):
    signals: list[QualitySignal]
    talkShare: TalkShare | None = None        # interview, computed in code from the turn times
    drift: list[Drift] = []                   # calibration, computed in code
    interviews: int | None = None             # calibration: how many interviews were read

# ---- GET /internal/v1/usage

class Usage(Strict):
    gatewayMode: Literal["live", "record", "replay"]
    liveCalls: int
    replayedCalls: int
    spentUsd: float
    capUsd: float
```
