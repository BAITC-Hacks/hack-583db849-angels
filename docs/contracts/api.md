# Public API contract — for Aibek (`apps/api`)

These are the exact endpoints the web screens call. They are derived from the screens that already run on scripted previews, so the shapes are known to fit:

| Screen | Route | Web PR |
| --- | --- | --- |
| Candidates | `/demo/candidates` | #34 |
| Simulation (M2) | `/simulation/:simulationId` | #35 |
| Commission report (M3) | `/commission/simulation-report/:assessmentId` | #39 |
| Candidate feedback (M3) | `/feedback/:assessmentId` | #39 |
| Interview (M4) | `/interviewer/interview/:interviewId` | #40, #43 |
| Brief (M1) | `/interviewer/brief/:candidateId` | #41 |

**How to use this file.** Implement it code-first: NestJS DTOs with `@nestjs/swagger` produce `apps/api/openapi.json`, and the web generates its client from that file (`docs/SPEC.md`, section 9). This file is the target; once your generated OpenAPI covers an endpoint, the OpenAPI wins and this file is updated to match. Conventions (auth, idempotency, error shape, ids) are in `docs/SPEC.md`, section 4, and are not repeated here.

**Examples.** Every response below has a JSON example for candidate A in [`examples/candidate-a/`](examples/candidate-a/). Use them as test fixtures and as the `DEMO_MODE` answers. They are exactly what the screens render today.

## What unblocks the web, in order

1. **F0.** `GET /v1/health`, and `apps/api/openapi.json` committed — even if it holds only health and candidates. The web cannot generate a single call before this file exists.
2. **Candidates.** `POST /v1/candidates`, `GET /v1/candidates` (with `?include=progress`), `GET /v1/candidates/:id/progress`, `GET /v1/scenarios`, with A, B and C seeded.
3. **M2 simulations.** The screen is ready and waits only for these four endpoints, plus the assessment the API starts by itself when a simulation completes.
4. **M3 assessments and candidate feedback.**
5. **M4 interviews,** with the recording upload.
6. **M1 briefs,** created by the API itself after a candidate is registered.
7. **Admin and demo:** `GET /v1/admin/overview`, `GET /v1/audit-events`, `POST /v1/demo/*`.
8. **M5 quality checks.** `POST /v1/quality-checks/interview`, `POST /v1/quality-checks/calibration`, `GET /v1/quality-checks` and `GET /v1/quality-checks/:id`.
9. **The scenario pool (M2b), consistency (C) and the surprise question (S).**

The step-by-step plan with owners and dates is `docs/INTEGRATION.md`.

The contract PR for each group is small and Aibek's alone: DTOs, the regenerated `openapi.json`, and the example as the answer until the implementation lands. No Pydantic, no web code. Merge it first; the implementation follows in a second PR.

## How the web calls you

The browser never holds an API key. The web calls a Next.js route on its own server (`/api/v1/*`), which adds the `X-API-Key` for the demo role and forwards the request to `API_INTERNAL_URL` unchanged: method, body (multipart streamed), `Idempotency-Key`, status and response body. So:

- no CORS is needed;
- every request reaches you with a key;
- `GET /v1/health` must answer without a key;
- on the server only the web is public; `api` is reachable only inside the Docker network.

## Roles

`docs/SPEC.md` lists `interviewer`, `commission` and `admin`. **This contract adds `platform`:** the key inVision's own system uses for candidate-facing calls — registering a candidate, running the simulation, fetching the candidate's feedback. It can never read a score, a brief or a draft. That is how "the candidate never sees a score" is enforced by the server rather than by the screen.

| Endpoint group | `platform` | `interviewer` | `commission` | `admin` |
| --- | --- | --- | --- | --- |
| Candidates — create, list, progress | yes ¹ | yes ¹ | yes | yes |
| Scenarios — the pool | — | yes | yes | yes |
| Accommodations — text mode | — | — | yes | yes |
| Decision date — for deleting videos | yes | — | yes | yes |
| C consistency — before the interview | — | yes | yes | yes |
| C consistency — after the interview | — | — | yes | yes |
| M1 briefs | — | yes | yes | yes |
| M2 simulations | yes | yes | yes | yes |
| M3 assessments — read scores | — | — | yes | yes |
| M3 assessments — re-run | — | — | — | yes |
| M3 candidate feedback | yes | yes | yes | yes |
| M4 interviews, recording, interviewer scores, draft | — | yes | read | yes |
| M5 quality checks | — | — | yes | yes |
| S surprise question — create, start, answer, status | yes ² | read | read | yes |
| S surprise answer — transcript and video | — | yes | yes | yes |
| Admin overview, audit events | — | — | — | yes |
| Demo: recorded session | — | — | yes | yes |
| Demo: reset | — | — | — | yes |

¹ `progress` is filtered by role: `platform` gets no `brief` and no `interview` and never a score; `interviewer` gets no `assessment` — they score blind.
² `platform` sees the question only after `start`, and never the competency it targets, the transcript or the video.

`API_KEYS` gets a fourth pair, for example `change-me-platform:platform`.

## Endpoints

✱ in the "Idem." column: the endpoint accepts `Idempotency-Key`.

### Health and candidates

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/health` | | `200 { "status": "ok" }` — no key needed | |
| `POST` | `/v1/candidates` | ✱ | `201 Candidate` — upsert by `externalId` | `400` |
| `GET` | `/v1/candidates` | | `200 { items: Candidate[] }`; with `?include=progress` each item also has `progress` | |
| `GET` | `/v1/candidates/:candidateId` | | `200 Candidate` | `404` |
| `GET` | `/v1/candidates/:candidateId/progress` | | `200 CandidateProgress` — filtered by role | `404` |
| `GET` | `/v1/scenarios` | | `200 ScenarioSummary[]` — the pool, staff only | |
| `PUT` | `/v1/candidates/:candidateId/accommodations` | | `200 Accommodation`; body `{ textMode, reason }` | `404`, `409 SIMULATION_STARTED` |
| `PUT` | `/v1/candidates/:candidateId/decision-date` | | `200 DecisionDate`; body `{ decidedAt }` — only the date of the commission's decision, never the decision | `400` a date in the future, `404` |

`CandidateProgress` is what every role's home reads: one call, every step's state and id. The homes poll it every 5 seconds while a step is `pending`.

### M1 — briefs

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/briefs` | ✱ | `201 Brief`; body `{ candidateId }` — admin re-run | `404` candidate, `502/503` AI |
| `GET` | `/v1/briefs/:briefId` | | `200 Brief` | `404` |
| `GET` | `/v1/candidates/:candidateId/brief` | | `200 Brief` — the latest | `404 BRIEF_NOT_FOUND` |

The last one exists because the screen is addressed by candidate, not by brief.

The brief's questions cover the five competencies **and** three topics the interviewer must settle: what the candidate knows about inVision U, how good their English really is, and whether the motivation is serious or the application was sent "because it is free". Its `consistency` block is the before-interview stage of section C.

**You create the brief yourself** right after `POST /v1/candidates`, again once the simulation is assessed, and again once a surprise answer is transcribed. `progress.brief.status` goes `pending → ready` (or `failed`). In `DEMO_MODE` the briefs for A, B and C come from the seed.

### M2 — simulations

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/simulations` | ✱ | `201 Simulation`, with the assigned scenario and the character's opening turn; body `{ candidateId }` | `404` candidate, `409 SIMULATION_EXISTS`, `503 NO_SCENARIO_READY` |
| `POST` | `/v1/simulations/:simulationId/turns` | ✱ | `200 TurnResult`; multipart `audio` (webm or ogg, up to 60 s). JSON `{ text }` only when the simulation's `inputMode` is `text` | `400` empty or over 1000 characters, `403 TEXT_MODE_NOT_ALLOWED`, `409 SIMULATION_FINISHED`, `409 TURN_IN_FLIGHT`, `422 SPEECH_NOT_RECOGNISED` |
| `GET` | `/v1/simulations/:simulationId/turns/:turnId/audio` | | `200 audio/mpeg` — the character's voice | `404` |
| `POST` | `/v1/simulations/:simulationId/complete` | | `200 Simulation`; body `{ reason: "completed" \| "stopped" }` | `409 SIMULATION_FINISHED` |
| `GET` | `/v1/simulations/:simulationId` | | `200 Simulation` with every turn | `404` |

- **One turn at a time.** A second turn while the first is still with the ML service answers `409 TURN_IN_FLIGHT`.
- **You keep the story's place.** Store each `director.nextBeat` the ML service returns, and send `state: { beat: <the latest nextBeat>, candidateTurns: <candidate turns so far, this one included> }` with every candidate turn. Only the opening line goes without `state`; the ML service refuses a candidate turn without it (`ml.md`, "Where the story is").
- **`Idempotency-Key` on `/turns` matters.** A network retry must not add the candidate's turn twice.
- **The simulation completes on its own** when the ML service reports `ended: true`. `/complete` with `stopped` is the candidate's stop button.
- **When a simulation completes, you start its assessment yourself.** `progress.assessment.status` goes `pending → ready` (or `failed`). Nobody has to press anything.
- **You assign the scenario.** Random among scenarios with `status: "ready"`, the least-assigned first, ties broken at random. One simulation per candidate: a second create answers `409 SIMULATION_EXISTS` with `details.simulationId`.
- **Turns are spoken.** The candidate turn's `text` is the transcript, `recognitionConfidence` is the lowest `confidence` among its transcribed segments (or `null`), and `characterAudioUrl` points at the character's voice. You ask for that voice with `speech { text, scenarioId }` — the ML service knows each character's voice; you never name one. Low confidence is a flag on the turn, never a penalty. Nothing was recognised → `422 SPEECH_NOT_RECOGNISED`, the turn is not stored, and the candidate records again.
- **Text only with an accommodation.** `inputMode` is `text` only when staff switched it on for this candidate (`PUT /v1/candidates/:id/accommodations`) before the simulation started; otherwise a JSON turn answers `403 TEXT_MODE_NOT_ALLOWED`. The report shows `accommodation: true`.

### M3 — assessments and candidate feedback

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/simulation-assessments` | ✱ | `201 Assessment`; body `{ simulationId }` — admin re-run; normally you start it on completion | `409 SIMULATION_NOT_FINISHED`, `409 NOTHING_TO_ASSESS`, `502/503` AI |
| `GET` | `/v1/simulation-assessments/:assessmentId` | | `200 Assessment` | `404`, `403` for `interviewer` and `platform` |
| `GET` | `/v1/simulation-assessments/:assessmentId/candidate-feedback` | | `200 CandidateFeedback` | `404` |

`Assessment` carries the transcript (`simulation.turns`), so the report renders in one call and every quote can link to its turn. Each candidate turn there carries `recognitionConfidence` (`docs/SPEC.md`, `Turn`), so the report can flag a turn the recogniser was unsure of.

**Nothing to assess.** A candidate who stops before saying anything has no turn to judge, and the ML service refuses such a transcript. Don't start an assessment then: `progress.assessment` stays `null`, and an admin re-run answers `409 NOTHING_TO_ASSESS`.

### M4 — interviews

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/interviews` | ✱ | `201 Interview`; body `{ candidateId, heldAt, interviewerRef?, transcript?, transcriptSource?, notes? }` | `404` candidate |
| `POST` | `/v1/interviews/:interviewId/recording` | ✱ | `202 Interview` with `transcriptStatus: "transcribing"`; multipart `audio` (webm, ogg or wav, up to 60 minutes) and `consent=true` | `400 CONSENT_REQUIRED`, `409 TRANSCRIPT_EXISTS`, `413` |
| `GET` | `/v1/interviews/:interviewId` | | `200 Interview`, including `transcriptStatus` and `transcript` | `404` |
| `POST` | `/v1/interviews/:interviewId/interviewer-scores` | ✱ | `201 InterviewerScoresSaved`; body `{ scores }` with **all five** keys | `400` a key missing, `409 SCORES_ALREADY_SAVED` |
| `POST` | `/v1/interviews/:interviewId/assessment-draft` | ✱ | `201 AssessmentDraft` | **`409 DRAFT_LOCKED`** before the scores, `409 TRANSCRIPT_MISSING` |
| `GET` | `/v1/interviews/:interviewId/assessment-draft` | | `200 AssessmentDraft` | **`409 DRAFT_LOCKED`** before the scores, `404 DRAFT_NOT_FOUND` |

- **The transcript comes one of two ways:**
  - **inVision's own recording:** `POST /v1/interviews` with `transcript` (turns with `speaker`, `text`, `startSec`, `endSec`) and `transcriptSource: "platform"`;
  - **recorded on the interviewer's screen:** `POST …/recording` with the audio.

  Either way you assign the turn ids `iturn_01`, `iturn_02`, …
- **The recording path.** The recording is sent to the ML service for transcription, and **you delete the audio as soon as the transcript is stored**. Only text is ever kept, and only text reaches a model. Without `consent=true` the upload is refused. `transcriptStatus` goes `none → transcribing → ready` (or `failed`); the web polls `GET /v1/interviews/:id`.
- **The draft needs a transcript.** Without one it answers `409 TRANSCRIPT_MISSING`. The scores may be saved before the transcript exists; the draft follows once it does.
- **You make the draft yourself** as soon as the transcript exists and the scores are saved, whichever comes second; `progress.interview.draftReady` turns `true`. `POST …/assessment-draft` is a re-run.
- **The scores are fixed once saved.** A repeat with the same `Idempotency-Key` returns the saved scores. A different body answers `409 SCORES_ALREADY_SAVED`.
- **The ML service never sees the interviewer's scores** when it writes the draft (see `ml.md`). The web compares the two itself.
- **Notes stay optional:** a list of strings, stored with ids `note_1`, `note_2`, … and sent to the draft as extra context.
- **`interviewerRef` is optional** and a pseudonym (`interviewer-2`), never a name. A calibration check (M5) reads the saved scores of the interviews that carry one.

### C — consistency: what was claimed against what was measured

A separate layer across all data about the candidate — application, test, certificate, the simulation's speech, the surprise answer, and after the interview its transcript. For example: the application says English C2, the simulation's speech measures B2.

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/candidates/:candidateId/consistency?stage=before` | | `200 ConsistencyReport` | `404 CONSISTENCY_NOT_FOUND` |
| `GET` | `/v1/candidates/:candidateId/consistency?stage=after` | | `200 ConsistencyReport` | `404 CONSISTENCY_NOT_FOUND`, `409 DRAFT_LOCKED` before the interviewer's scores |

- **You create both stages yourself.**
  - `before`: the brief's own `consistency` block. The ML service returns it inside `brief`, so there is no separate call; `?stage=before` serves the latest brief's items;
  - `after`: when the interview transcript exists **and** the interviewer's scores are saved. It reads the interview, so it stays locked until the interviewer has scored blind, like the draft.
- **Every item is a signal with evidence, never a verdict:** what was claimed (with its quote), what was observed (with its quote or measured value), a status, what to do, and — before the interview — a question to ask.
- `progress.consistency` carries both stages' status.

### S — the surprise question (video and voice)

One question about the candidate's own application, one attempt, 90 seconds, on camera. See `docs/INTEGRATION.md`, section 10.

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/surprise-questions` | ✱ | `201 SurpriseQuestion` with `status: "ready"` and `question: null`; body `{ candidateId }` | `404` candidate, `409 SURPRISE_EXISTS` |
| `POST` | `/v1/surprise-questions/:surpriseId/start` | ✱ | `200 SurpriseQuestion` with the question, `startedAt` and a **server** `answerDeadline` | `409 ALREADY_STARTED` |
| `POST` | `/v1/surprise-questions/:surpriseId/answer` | ✱ | `202 SurpriseQuestion` with `status: "transcribing"`; multipart `video` (webm or mp4, up to 50 MB), `consentVideo=true`, `consentProcessing=true` | `400 CONSENT_REQUIRED`, `409 DEADLINE_PASSED`, `409 ALREADY_ANSWERED`, `413` |
| `GET` | `/v1/surprise-questions/:surpriseId` | | `200 SurpriseQuestion` — fields by role | `404` |
| `GET` | `/v1/surprise-questions/:surpriseId/video` | | `200 video/webm`, streamed | `403` for `platform`, `404` |

- **The question is written by the ML service** from the candidate's application when the surprise is created, and **revealed only by `start`**.
- **One attempt, held by the server:** a second `start` answers `409 ALREADY_STARTED`, and an answer after `answerDeadline` + 15 s answers `409 DEADLINE_PASSED`.
- **The video never reaches a model.** You extract the audio (`ffmpeg`), send it to `POST /internal/v1/transcribe` with one speaker, store the transcript as segments `sseg_01`, `sseg_02`, …, and delete the audio. The video file stays for staff playback only.
- **Every video view is an audit event.** The video is deleted on demo reset and 30 days after the decision.
- **The decision date comes from inVision.** The commission decides in inVision's own system; the platform sends only its date with `PUT /v1/candidates/:id/decision-date`. An hourly sweep deletes every video whose candidate was decided 30 days ago or more (`VIDEO_RETENTION_DAYS`) and writes `surprise.video.deleted`. The transcript stays, and `videoAvailable` turns `false`.
- **Once the answer is transcribed,** you create a new brief and send the question and the segments in `BriefRequest.surpriseAnswer` (`ml.md`, rule 6c), so its quotes can cite `surprise_answer`.

### Admin and demo

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/admin/overview` | | `200 AdminOverview` | |
| `GET` | `/v1/audit-events?limit=50` | | `200 { items: AuditEvent[] }`, newest first | |
| `POST` | `/v1/demo/recorded-session` | ✱ | `200 CandidateProgress`; body `{ candidateId }` — completes that candidate's simulation from the seed transcript and starts its assessment | `404` when `DEMO_MODE` is off |
| `POST` | `/v1/demo/reset` | | `204`; drops every simulation, assessment, interview, surprise and video and re-seeds A, B and C | `404` when `DEMO_MODE` is off |

### M5 — quality checks

The process, not the candidate. Every output is a signal about how an interview was run or how an interviewer's scale sits against the panel's, with a recommendation — never a verdict, and never a word about any candidate.

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/quality-checks/interview` | ✱ | `201 QualityCheck`; body `{ interviewId }` — the questions are the interviewer's turns in the transcript | `404`, `409 TRANSCRIPT_MISSING` |
| `POST` | `/v1/quality-checks/calibration` | ✱ | `201 QualityCheck`; body `{ interviewerRef, from, to }` — dates are `YYYY-MM-DD`, `to` excluded | `404`, `409 NOT_ENOUGH_HISTORY` under three interviews |
| `GET` | `/v1/quality-checks` | | `200 { items: QualityCheck[] }`, newest first; `?kind=interview\|calibration`, `?interviewerRef=`, `?limit=` (default 20) | |
| `GET` | `/v1/quality-checks/:qualityCheckId` | | `200 QualityCheck` | `404` |

- **An interview check reads only the transcript.** The interviewer's turns are what is examined; the candidate's turns are context and are never quoted back as a finding about the candidate.
- **A calibration check reads saved scores.** You send the ML service the history for `interviewerRef` and for the rest of the panel over the same period, pseudonymously — no candidate, no name. It returns the means, the difference and what to do about it.
- **`interviewerRef` is a pseudonym** (`interviewer-2`), the same one the interview carries. The panel is everyone else in the period.
- **Both checks are re-runnable:** a new check is a new row; nothing is overwritten, so a panel can see whether a recommendation was followed.

## DTOs

TypeScript interfaces for brevity. As classes, every field gets `class-validator` rules and `@ApiProperty`. The shared types (`Evidence`, `DriveScore`, `EnglishMetrics`, `Turn`) are defined once in `docs/SPEC.md`, section 6.

```ts
type Competency = 'D' | 'R' | 'I' | 'V' | 'E';
type Score = 0 | 1 | 2 | 3 | 4 | null;           // null: not enough verified evidence

interface Evidence {
  source: 'application_field' | 'test_item' | 'simulation_turn' | 'interview_turn' | 'interview_note' | 'surprise_answer';
  sourceId: string;
  quote: string;                                  // verbatim; never translated
}

interface DriveScore {
  competency: Competency;
  score: Score;
  confidence: 'low' | 'medium' | 'high' | null;   // null exactly when score is null
  rationale: string | null;
  evidence: Evidence[];                           // at least one when score is not null
}

interface Candidate {
  candidateId: string;
  externalId: string;
  label: string;                                  // "Candidate A" for the seed; never the profile name
  createdAt: string;
  progress?: CandidateProgress;                   // only with ?include=progress
}

type StepStatus = 'pending' | 'ready' | 'failed';

interface CandidateProgress {                     // filtered by role, see the Roles table
  candidateId: string;
  label: string;
  brief: { briefId: string; status: StepStatus } | null;
  simulation: { simulationId: string; status: 'active' | 'completed'; ending: 'completed' | 'stopped' | null } | null;
  assessment: { assessmentId: string; status: StepStatus } | null;
  interview: {
    interviewId: string;
    transcriptStatus: 'none' | 'transcribing' | 'ready' | 'failed';
    scoresSaved: boolean;
    draftReady: boolean;
  } | null;
  surprise: { surpriseId: string; status: SurpriseStatus } | null;
  consistency: { before: StepStatus | null; after: StepStatus | 'locked' | null };
  accommodation: { textMode: boolean; reason: string } | null;  // staff only; null until set, and always for platform
}

interface Brief {
  briefId: string;
  candidateId: string;
  createdAt: string;
  summary: string;
  questions: { focus: BriefFocus; question: string; why: string; evidence: Evidence[] }[];  // at least one per focus
  consistency: ConsistencyItem[];                 // the before-interview stage of section C
  clarify: { topic: string; evidence: Evidence[] }[];
  english: {
    certificate: { type: string; score: string; cefr: string } | null;
    writtenCefr: string;
    basis: string;
  };
  sources: {                                      // the answers the quotes point into; no profile data
    application: { fieldId: string; question: string; answer: string }[];
    test: { itemId: string; response: string }[];
    surpriseAnswer: { surpriseId: string; question: string; segments: SurpriseSegment[] } | null;
  };
}

type BriefFocus = Competency | 'invision_knowledge' | 'english' | 'motivation';

type ConsistencyTopic = 'english' | 'invision_knowledge' | 'motivation' | 'experience' | 'achievements' | 'other';

interface ConsistencyItem {
  itemId: string;
  topic: ConsistencyTopic;
  claim: { text: string; evidence: Evidence[] };                 // what the candidate said about themselves
  observation: {
    text: string;
    evidence: Evidence[];                                        // quotes from the simulation, test, surprise or interview
    metric: { name: keyof EnglishMetrics; value: string | number; source: 'simulation' | 'surprise' | 'interview' } | null;
  };
  status: 'consistent' | 'discrepancy' | 'unverified' | 'confirmed' | 'resolved';
  whatToDo: string;                                              // a recommendation for people, never a decision
  askInInterview: string | null;                                 // before the interview only
}

interface ConsistencyReport {
  candidateId: string;
  stage: 'before' | 'after';
  createdAt: string;
  items: ConsistencyItem[];
}

interface ScenarioSummary {
  scenarioId: string;
  title: string;
  status: 'draft' | 'ready';                      // only ready scenarios are assigned
  competencies: Competency[];                     // must be all five to become ready
  assignedCount: number;
}

interface Accommodation {
  candidateId: string;
  textMode: boolean;
  reason: string;
  setByRole: 'commission' | 'admin';
  setAt: string;
}

interface ScenarioBrief {                         // public part only; the character's hidden motive never leaves ml
  scenarioId: string;
  title: string;
  situation: string;
  yourRole: string;
  goal: string;
  character: { name: string; role: string; wants: string };
  expectedMinutes: number;
  maxCandidateTurns: number;
}

type Stage = 'opening' | 'in-progress' | 'wrapping-up' | 'finished';

interface Simulation {
  simulationId: string;
  candidateId: string;
  scenario: ScenarioBrief;
  mode: 'voice' | 'text';
  accommodation: boolean;                         // text mode switched on by staff
  status: 'active' | 'completed';
  stage: Stage;
  ending: 'completed' | 'stopped' | null;
  startedAt: string;
  completedAt: string | null;
  turns: Turn[];
}

interface TurnResult {
  candidateTurn: Turn;
  characterTurn: Turn;                            // at most 60 words
  stage: Stage;
  status: 'active' | 'completed';
  candidateTurns: number;
  recognitionConfidence: number | null;           // voice turns; null for an accommodated text turn
  characterAudioUrl: string | null;               // relative to /v1
}

interface Assessment {
  assessmentId: string;
  simulationId: string;
  candidateId: string;
  candidateLabel: string;
  createdAt: string;
  simulation: {
    scenarioTitle: string;
    characterName: string;                        // labels the character's turns in the transcript
    mode: 'voice' | 'text';
    accommodation: boolean;
    completedAt: string;
    durationSeconds: number;
    turns: Turn[];
  };
  scores: DriveScore[];                           // all five, in D R I V E order
  english: EnglishMetrics;                        // speech measures are null only for an accommodated text simulation
  interviewQuestions: { competency: Competency; question: string; reason: string }[];
}

interface CandidateFeedback {                     // no score, number or decision wording — ever
  assessmentId: string;
  scenarioTitle: string;
  strengths: string[];
  growth: string[];
  nextTime: string[];
}

interface InterviewTurn {
  turnId: string;                                 // iturn_01, iturn_02, … assigned by api
  speaker: 'interviewer' | 'candidate';
  text: string;                                   // verbatim, never translated
  startSec: number;
  endSec: number;
}

interface Interview {
  interviewId: string;
  candidateId: string;
  candidateLabel: string;
  interviewerRef: string | null;                  // a pseudonym such as `interviewer-2`; M5 calibrates by it
  heldAt: string;
  transcriptStatus: 'none' | 'transcribing' | 'ready' | 'failed';
  transcriptSource: 'platform' | 'recording' | null;
  transcript: InterviewTurn[] | null;
  notes: { id: string; text: string }[];          // optional extra; ids note_1, note_2, …
  interviewerScores: Record<Competency, Score> | null;
  scoredAt: string | null;
}

interface InterviewerScoresSaved {
  interviewId: string;
  scores: Record<Competency, Score>;
  savedAt: string;
}

interface AssessmentDraft {
  interviewId: string;
  createdAt: string;
  scores: DriveScore[];                           // evidence: the candidate's interview turns (and notes, if any)
}

type SurpriseStatus = 'ready' | 'started' | 'transcribing' | 'answered' | 'expired' | 'failed';

interface SurpriseSegment {
  segmentId: string;                              // sseg_01, sseg_02, …
  text: string;                                   // verbatim, never translated
  startSec: number;
  endSec: number;
}

interface DecisionDate {
  candidateId: string;
  decidedAt: string;                              // when the commission decided — the date only, never the outcome
  videosDeletedAfter: string;                     // decidedAt + VIDEO_RETENTION_DAYS (30)
}

interface SurpriseQuestion {
  surpriseId: string;
  candidateId: string;
  status: SurpriseStatus;
  question: string | null;                        // null until start
  answerSeconds: number;                          // 90
  startedAt: string | null;
  answerDeadline: string | null;                  // server time; the client counts down to it
  // staff only — absent for platform:
  competency?: Competency;
  why?: string;
  segments?: SurpriseSegment[] | null;
  videoAvailable?: boolean;
}

interface AdminOverview {
  demoMode: boolean;
  gatewayMode: 'live' | 'record' | 'replay';
  ml: 'up' | 'down';
  usage: { liveCalls: number; replayedCalls: number; spentUsd: number; capUsd: number };
  modules: { module: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'S'; state: 'on' | 'off' }[];
  counts: { candidates: number; simulationsCompleted: number; assessmentsReady: number; interviewsScored: number };
}

type AuditAction =
  | 'candidate.created' | 'brief.ready' | 'simulation.started' | 'simulation.completed' | 'simulation.stopped'
  | 'assessment.ready' | 'interview.created' | 'recording.uploaded' | 'transcript.ready' | 'scores.saved'
  | 'draft.created' | 'surprise.started' | 'surprise.answered' | 'surprise.video.viewed' | 'surprise.video.deleted' | 'demo.reset';

interface AuditEvent {
  eventId: string;
  at: string;
  actorRole: 'platform' | 'interviewer' | 'commission' | 'admin' | 'system';
  action: AuditAction;                            // the web turns it into a sentence in EN or RU
  candidateId: string | null;
  candidateLabel: string | null;
  subjectId: string | null;
}

interface QualityCheck {
  qualityCheckId: string;
  kind: 'interview' | 'calibration';
  createdAt: string;
  interviewId: string | null;                     // interview checks
  interviewerRef: string | null;                  // both kinds, when the interview names one
  from: string | null;                            // calibration period, `YYYY-MM-DD`
  to: string | null;
  interviews: number | null;                      // calibration: how many interviews it read
  talkShare: { interviewer: number; candidate: number } | null;   // interview: share of speaking time
  drift: { competency: Competency; interviewerMean: number; panelMean: number; delta: number }[];   // calibration
  signals: QualitySignal[];                       // signals and recommendations, never a verdict about a candidate
}

interface QualitySignal {
  kind: 'leading_question' | 'off_limits_question' | 'coverage_gap' | 'scale_drift';
  message: string;
  recommendation: string;                         // what a person could do next, never what to decide
  competencies: Competency[];                     // empty when the signal is not about a competency
  evidence: Evidence[];                           // verbatim interviewer turns; empty for coverage and drift
}
```

## Error codes

| Code | Status | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | missing or unknown `X-API-Key` |
| `FORBIDDEN` | 403 | the role may not call this |
| `VALIDATION_ERROR` | 400 | the body does not match the DTO; `details.fields` lists the fields |
| `NOT_FOUND` | 404 | generic; the specific ones below where the screen needs to tell them apart |
| `BRIEF_NOT_FOUND`, `DRAFT_NOT_FOUND` | 404 | nothing generated yet |
| `IDEMPOTENCY_KEY_REUSED` | 409 | same key, different body |
| `SIMULATION_FINISHED` | 409 | a turn or a complete after the end |
| `SIMULATION_NOT_FINISHED` | 409 | assessing an active simulation |
| `NOTHING_TO_ASSESS` | 409 | assessing a simulation the candidate stopped before saying anything |
| `TURN_IN_FLIGHT` | 409 | a turn while the previous one is still being answered |
| `SCORES_ALREADY_SAVED` | 409 | new interviewer scores after the first save |
| `DRAFT_LOCKED` | 409 | the draft requested before the interviewer's scores exist |
| `TRANSCRIPT_MISSING` | 409 | a draft or an interview check before the transcript exists |
| `TRANSCRIPT_EXISTS` | 409 | a second recording for an interview that already has a transcript |
| `CONSENT_REQUIRED` | 400 | a recording or a surprise answer uploaded without its consent fields |
| `SIMULATION_EXISTS` | 409 | a second simulation for the same candidate; `details.simulationId` |
| `SIMULATION_STARTED` | 409 | an accommodation changed after the simulation started |
| `NO_SCENARIO_READY` | 503 | no scenario in the pool has passed the quality bench |
| `NOT_ENOUGH_HISTORY` | 409 | a calibration check over fewer than three interviews |
| `TEXT_MODE_NOT_ALLOWED` | 403 | a text turn without an accommodation |
| `SPEECH_NOT_RECOGNISED` | 422 | nothing was recognised in the audio; record again |
| `CONSISTENCY_NOT_FOUND` | 404 | that stage has not been produced yet |
| `SURPRISE_EXISTS` | 409 | a second surprise question for the same candidate |
| `ALREADY_STARTED` | 409 | the surprise question was already revealed |
| `ALREADY_ANSWERED` | 409 | a second answer to the surprise question |
| `DEADLINE_PASSED` | 409 | the surprise answer arrived after the deadline plus 15 seconds |
| `PAYLOAD_TOO_LARGE` | 413 | audio over 60 minutes or video over 50 MB |
| `AI_INVALID_OUTPUT` | 502 | the ML service failed schema or evidence checks after its one retry |
| `AI_UNAVAILABLE` | 503 | the ML service is down |
| `AI_BUDGET_EXCEEDED` | 503 | the gateway refused: `BUDGET_USD_CAP` reached |

## Which ML call each endpoint makes

`api` always sends `toLLMView()` output, never the snapshot (`docs/SPEC.md`, section 6).

| Public endpoint | ML endpoint | `api` stores |
| --- | --- | --- |
| `POST /v1/candidates`, an assessment becoming ready, a surprise answer transcribed | `POST /internal/v1/brief` | the brief, with its `consistency` block — the before stage of C |
| `POST /v1/simulations/:id/turns` | `POST /internal/v1/simulation/turn` with the whole transcript | both turns, the director's decision (audit only, never returned) |
| a simulation completing, or `POST /v1/simulation-assessments` | `POST /internal/v1/simulation/assessment` | scores, English, questions and feedback — feedback served separately |
| `POST /v1/simulations` | `GET /internal/v1/scenarios`, pick, then `simulation/turn` with no turns, then `speech` | the simulation, the opening turn and its audio |
| `POST /v1/simulations/:id/turns` | `POST /internal/v1/transcribe` (one speaker), then `simulation/turn`, then `POST /internal/v1/speech` | the transcript as the turn text, the matched branch (audit), the character's audio |
| interviewer's scores saved + transcript ready | `POST /internal/v1/consistency` with `stage: "after"` | the after report |
| `POST /v1/interviews/:id/recording` | `POST /internal/v1/transcribe` (two speakers) | the transcript; **the audio is deleted** once it is stored |
| `POST /v1/surprise-questions` | `POST /internal/v1/surprise-question` | the question, its competency and why |
| `POST /v1/surprise-questions/:id/answer` | `POST /internal/v1/transcribe` (one speaker), with the audio only | the segments; the audio is deleted, the video kept for staff |
| `GET /v1/admin/overview` | `GET /internal/v1/usage` | nothing |
| `POST /v1/interviews/:id/assessment-draft` | `POST /internal/v1/interview/draft` with the transcript and notes — never the interviewer's scores | the draft |
| `POST /v1/quality-checks/interview` | `POST /internal/v1/quality-check` with `kind: "interview"` and the transcript | the check |
| `POST /v1/quality-checks/calibration` | `POST /internal/v1/quality-check` with `kind: "calibration"` and the pseudonymous score history | the check |

### When the ML service fails

The ML service answers with a code from `ml.md`, section "Errors". The three `AI_*` codes pass through unchanged; everything else is a fault in `api` or in the deployment, which you log with its `traceId` and do not show the candidate as such:

| ML answers | You answer |
| --- | --- |
| `502 AI_INVALID_OUTPUT`, `503 AI_UNAVAILABLE`, `503 AI_BUDGET_EXCEEDED` | the same status and code |
| `401 UNAUTHORIZED`, `404 AUDIO_NOT_FOUND`, `500 INTERNAL_ERROR`, no answer at all | `503 AI_UNAVAILABLE` |
| `422 VALIDATION_ERROR`, `400 INVALID_AUDIO_REF`, `404 SCENARIO_NOT_FOUND` | `500` — the request you built was wrong |

`AUDIO_NOT_FOUND` nearly always means `api` and `ml` do not share the `UPLOADS_DIR` volume — check Compose first.

## Tests this contract needs

These go in the same PR as the rule they test, as `AGENTS.md` requires:

- `toLLMView()` drops `profile` and redacts profile values found inside answers;
- no request to `ml` ever contains a profile field — a spy on `ai-client`;
- `GET` and `POST` on `/assessment-draft` answer `409 DRAFT_LOCKED` before the interviewer's scores, `409 TRANSCRIPT_MISSING` without a transcript, and `200`/`201` after both;
- a recording without `consent=true` → `400 CONSENT_REQUIRED`; after transcription the audio file no longer exists;
- a second, different score save answers `409 SCORES_ALREADY_SAVED`;
- `interviewer` and `platform` get `403` on `GET /v1/simulation-assessments/:id`;
- `platform` gets `403` on briefs and drafts;
- no key → `401`, wrong role → `403`, `/v1/health` → `200` without a key;
- same `Idempotency-Key` + same body → same resource; different body → `409 IDEMPOTENCY_KEY_REUSED`;
- a turn while one is in flight → `409 TURN_IN_FLIGHT`;
- `progress` for `platform` has no `brief`, no `interview` and no score; for `interviewer` it has no `assessment`;
- a completed simulation gets its assessment without anyone calling `POST /v1/simulation-assessments`;
- the surprise question: `question` is `null` before `start`; a second `start` → `409 ALREADY_STARTED`; an answer after the deadline → `409 DEADLINE_PASSED`; `platform` gets `403` on the video; every video view writes an audit event;
- `POST /v1/demo/*` answers `404` when `DEMO_MODE` is off;
- scenario assignment: only `ready` scenarios, least-assigned first; a second create → `409 SIMULATION_EXISTS`;
- a JSON turn without an accommodation → `403 TEXT_MODE_NOT_ALLOWED`;
- `consistency?stage=after` → `409 DRAFT_LOCKED` before the interviewer's scores;
- every candidate turn sent to ML carries `state` with the previous `director.nextBeat` — a spy on `ai-client`;
- an `AI_BUDGET_EXCEEDED` from ML reaches the client as `503 AI_BUDGET_EXCEEDED`, and an `AUDIO_NOT_FOUND` as `503 AI_UNAVAILABLE`;
- an interview quality check without a transcript → `409 TRANSCRIPT_MISSING`, and a calibration over fewer than three interviews → `409 NOT_ENOUGH_HISTORY`;
- no quality check, of either kind, contains a `candidateId` or a candidate label — a check is about the process;
- the history sent for a calibration carries no candidate field at all — a spy on `ai-client`.
