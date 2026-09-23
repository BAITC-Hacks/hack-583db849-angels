"""Frozen internal wire schemas from docs/contracts/ml.md."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Strict(BaseModel):
    """Every schema rejects fields it does not know: a profile field cannot slip through."""

    model_config = ConfigDict(extra="forbid")


Competency = Literal["D", "R", "I", "V", "E"]
Score = Annotated[int, Field(ge=0, le=4)] | None
Confidence = Literal["low", "medium", "high"]
SourceKind = Literal[
    "application_field",
    "test_item",
    "simulation_turn",
    "interview_turn",
    "interview_note",
    "surprise_answer",
]
TurnId = Annotated[str, Field(pattern=r"^turn_\d{2,}$")]


class HealthResponse(Strict):
    status: Literal["ok"]


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


class Character(Strict):
    name: str
    role: str
    wants: str


class AnswerType(Strict):
    """One kind of answer the candidate may give in a beat, recognised by the mini-ML from its examples."""

    answerTypeId: str
    description: str
    examples: Annotated[list[str], Field(min_length=3)]
    next: str
    characterIntent: str


class Beat(Strict):
    beatId: str
    goal: str
    competencies: list[Competency]
    answerTypes: Annotated[list[AnswerType], Field(min_length=3, max_length=5)]
    fallback: AnswerType
    maxTurns: int


class ScenarioConfig(Strict):
    """config/scenarios/<id>.json. Only the public fields leave the service, as ScenarioBrief."""

    scenarioId: str
    status: Literal["draft", "ready"]
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
        if {competency for beat in self.beats for competency in beat.competencies} != {
            "D",
            "R",
            "I",
            "V",
            "E",
        }:
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


class TurnState(Strict):
    beat: str
    candidateTurns: int


class TurnRequest(Strict):
    scenarioId: str
    turns: list[Turn]
    state: TurnState | None = None


class DirectorDecision(Strict):
    """Logged for audit, never shown to the candidate."""

    beat: str
    matchedAnswerType: str
    similarity: Annotated[float, Field(ge=-1, le=1)] | None
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


class AssessmentRequest(Strict):
    candidateId: str
    scenarioId: str
    mode: Literal["voice", "text"]
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


class BriefRequest(Strict):
    candidate: CandidateView
    simulationEnglish: EnglishMetrics | None = None


BriefFocus = Literal[
    "D",
    "R",
    "I",
    "V",
    "E",
    "invision_knowledge",
    "english",
    "motivation",
]


class BriefQuestion(Strict):
    focus: BriefFocus
    question: str
    why: str
    evidence: list[Evidence]


ConsistencyTopic = Literal[
    "english",
    "invision_knowledge",
    "motivation",
    "experience",
    "achievements",
    "other",
]


class Claim(Strict):
    text: str
    evidence: list[Evidence]


class Metric(Strict):
    name: Literal[
        "wordsPerMinute",
        "fillerRate",
        "meanTurnLength",
        "lexicalDiversity",
        "grammarErrorsPer100Words",
        "cefrEstimate",
    ]
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
    whatToDo: str
    askInInterview: str | None


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
    questions: list[BriefQuestion]
    consistency: list[ConsistencyItem]
    clarify: list[BriefTopic]
    english: BriefEnglish

    @field_validator("questions")
    @classmethod
    def every_focus_asked(cls, questions: list[BriefQuestion]) -> list[BriefQuestion]:
        needed = {"D", "R", "I", "V", "E", "invision_knowledge", "english", "motivation"}
        if not needed <= {question.focus for question in questions}:
            raise ValueError("the brief asks at least one question per focus")
        return questions


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


class TranscribeRequest(Strict):
    purpose: Literal["interview", "surprise", "turn"]
    audioRef: str
    language: Literal["en"] = "en"
    speakers: Literal[1, 2] = 2


class TranscribeResult(Strict):
    turns: list[TranscribedTurn]
    durationSec: float


class DraftRequest(Strict):
    """The transcript and any notes. The interviewer's scores are deliberately absent, and extra fields are refused."""

    candidateId: str
    transcript: list[InterviewTurn]
    notes: list[InterviewNote] = []


class DraftResult(Strict):
    scores: list[DriveScore]

    @field_validator("scores")
    @classmethod
    def every_competency_once(cls, scores: list[DriveScore]) -> list[DriveScore]:
        return all_five(scores)


class ConsistencyRequest(Strict):
    stage: Literal["before", "after"]
    candidate: CandidateView
    simulationEnglish: EnglishMetrics | None = None
    simulationTurns: list[Turn] = []
    interviewTranscript: list[InterviewTurn] = []


class ConsistencyResult(Strict):
    items: list[ConsistencyItem]


class SpeechRequest(Strict):
    text: str
    voice: str


class SurpriseRequest(Strict):
    candidate: CandidateView


class SurpriseResult(Strict):
    question: str
    competency: Competency
    why: str

    @field_validator("question")
    @classmethod
    def short_enough_to_answer(cls, question: str) -> str:
        if len(question.split()) > 40:
            raise ValueError("a surprise question is at most 40 words")
        return question


SignalKind = Literal[
    "leading_question",
    "off_limits_question",
    "coverage_gap",
    "scale_drift",
]


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
    transcript: list[InterviewTurn] = []
    history: list[ScoredInterview] = []
    interviewerRef: str | None = None
    periodFrom: str | None = None
    periodTo: str | None = None

    @model_validator(mode="after")
    def one_kind_of_input(self) -> "QualityCheckRequest":
        if self.kind == "interview" and (not self.transcript or self.history):
            raise ValueError("an interview check reads a transcript and nothing else")
        if self.kind == "calibration" and (
            not self.history or self.transcript or not self.interviewerRef
        ):
            raise ValueError("a calibration check reads a history and needs an interviewerRef")
        return self


class QualitySignal(Strict):
    kind: SignalKind
    message: str
    recommendation: str
    competencies: list[Competency] = []
    evidence: list[Evidence] = []

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
    talkShare: TalkShare | None = None
    drift: list[Drift] = []
    interviews: int | None = None


class Usage(Strict):
    gatewayMode: Literal["live", "record", "replay"]
    liveCalls: int
    replayedCalls: int
    spentUsd: float
    capUsd: float
