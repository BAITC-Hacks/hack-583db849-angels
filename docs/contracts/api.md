# Public API contract — for Nauryzbek (`apps/api`)

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
2. **Candidates.** `POST /v1/candidates` and `GET /v1/candidates`, with A, B and C seeded.
3. **M2 simulations.** The screen is ready and waits only for these four endpoints.
4. **M3 assessments and candidate feedback.**
5. **M4 interviews.**
6. **M1 briefs.**
7. **M5 quality checks.** These are drafts; finalise them in the M5 contract PR.

The contract PR for each group is small: DTOs, the regenerated `openapi.json`, and the example as a fixture. Merge it first. Implementation follows in a second PR.

## How the web calls you

The browser never holds an API key. The web calls a Next.js route on its own server (`/api/v1/*`), which adds the `X-API-Key` for the demo role and forwards the request to `API_INTERNAL_URL`. So:

- no CORS is needed;
- every request reaches you with a key;
- `GET /v1/health` must answer without a key.

## Roles

`docs/SPEC.md` lists `interviewer`, `commission` and `admin`. **This contract adds `platform`:** the key inVision's own system uses for candidate-facing calls — registering a candidate, running the simulation, fetching the candidate's feedback. It can never read a score, a brief or a draft. That is how "the candidate never sees a score" is enforced by the server rather than by the screen.

| Endpoint group | `platform` | `interviewer` | `commission` | `admin` |
| --- | --- | --- | --- | --- |
| Candidates — create, list | yes | yes | yes | yes |
| M1 briefs | — | yes | yes | yes |
| M2 simulations | yes | yes | yes | yes |
| M3 assessments — create, read scores | — | — | yes | yes |
| M3 candidate feedback | yes | yes | yes | yes |
| M4 interviews, interviewer scores, draft | — | yes | read | yes |
| M5 quality checks | — | — | yes | yes |

`API_KEYS` gets a fourth pair, for example `change-me-platform:platform`.

## Endpoints

✱ in the "Idem." column: the endpoint accepts `Idempotency-Key`.

### Health and candidates

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/health` | | `200 { "status": "ok" }` — no key needed | |
| `POST` | `/v1/candidates` | ✱ | `201 Candidate` — upsert by `externalId` | `400` |
| `GET` | `/v1/candidates` | | `200 { items: Candidate[] }` | |
| `GET` | `/v1/candidates/:candidateId` | | `200 Candidate` | `404` |

### M1 — briefs

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/briefs` | ✱ | `201 Brief`; body `{ candidateId }` | `404` candidate, `502/503` AI |
| `GET` | `/v1/briefs/:briefId` | | `200 Brief` | `404` |
| `GET` | `/v1/candidates/:candidateId/brief` | | `200 Brief` — the latest | `404 BRIEF_NOT_FOUND` |

The last one exists because the screen is addressed by candidate, not by brief.

### M2 — simulations

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/simulations` | ✱ | `201 Simulation`, with the character's opening turn; body `{ candidateId, scenarioId, mode }` | `404` candidate or scenario |
| `POST` | `/v1/simulations/:simulationId/turns` | ✱ | `200 TurnResult`; body `{ text }` | `400` empty or over 1000 characters, `409 SIMULATION_FINISHED`, `409 TURN_IN_FLIGHT` |
| `POST` | `/v1/simulations/:simulationId/complete` | | `200 Simulation`; body `{ reason: "completed" \| "stopped" }` | `409 SIMULATION_FINISHED` |
| `GET` | `/v1/simulations/:simulationId` | | `200 Simulation` with every turn | `404` |

- **One turn at a time.** A second turn while the first is still with the ML service answers `409 TURN_IN_FLIGHT`.
- **`Idempotency-Key` on `/turns` matters.** A network retry must not add the candidate's turn twice.
- **The simulation completes on its own** when the ML service reports `ended: true`. `/complete` with `stopped` is the candidate's stop button.

### M3 — assessments and candidate feedback

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/simulation-assessments` | ✱ | `201 Assessment`; body `{ simulationId }` | `409 SIMULATION_NOT_FINISHED`, `502/503` AI |
| `GET` | `/v1/simulation-assessments/:assessmentId` | | `200 Assessment` | `404`, `403` for `interviewer` and `platform` |
| `GET` | `/v1/simulation-assessments/:assessmentId/candidate-feedback` | | `200 CandidateFeedback` | `404` |

`Assessment` carries the transcript (`simulation.turns`), so the report renders in one call and every quote can link to its turn.

### M4 — interviews

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/interviews` | ✱ | `201 Interview`; body `{ candidateId, heldAt, transcript?, transcriptSource?, notes? }` | `404` candidate |
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
- **The scores are fixed once saved.** A repeat with the same `Idempotency-Key` returns the saved scores. A different body answers `409 SCORES_ALREADY_SAVED`.
- **The ML service never sees the interviewer's scores** when it writes the draft (see `ml.md`). The web compares the two itself.
- **Notes stay optional:** a list of strings, stored with ids `note_1`, `note_2`, … and sent to the draft as extra context.

### M5 — quality checks (draft)

| Method | Path | Idem. | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/v1/quality-checks/interview` | ✱ | `201 QualityCheck`; body `{ interviewId }` — the questions are the interviewer's turns in the transcript | `404`, `409 TRANSCRIPT_MISSING` |
| `POST` | `/v1/quality-checks/calibration` | ✱ | `201 QualityCheck`; body `{ interviewerRef, from, to }` | |
| `GET` | `/v1/quality-checks/:qualityCheckId` | | `200 QualityCheck` | `404` |

## DTOs

TypeScript interfaces for brevity. As classes, every field gets `class-validator` rules and `@ApiProperty`. The shared types (`Evidence`, `DriveScore`, `EnglishMetrics`, `Turn`) are defined once in `docs/SPEC.md`, section 6.

```ts
type Competency = 'D' | 'R' | 'I' | 'V' | 'E';
type Score = 0 | 1 | 2 | 3 | 4 | null;           // null: not enough verified evidence

interface Evidence {
  source: 'application_field' | 'test_item' | 'simulation_turn' | 'interview_turn' | 'interview_note';
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
}

interface Brief {
  briefId: string;
  candidateId: string;
  createdAt: string;
  summary: string;
  questions: { competency: Competency; question: string; why: string; evidence: Evidence[] }[];
  flags: { title: string; ask: string; sources: [Evidence, Evidence] }[];
  clarify: { topic: string; evidence: Evidence[] }[];
  english: {
    certificate: { type: string; score: string; cefr: string } | null;
    writtenCefr: string;
    basis: string;
  };
  sources: {                                      // the answers the quotes point into; no profile data
    application: { fieldId: string; question: string; answer: string }[];
    test: { itemId: string; response: string }[];
  };
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
  mode: 'text' | 'voice';
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
}

interface Assessment {
  assessmentId: string;
  simulationId: string;
  candidateId: string;
  createdAt: string;
  simulation: { scenarioTitle: string; mode: 'text' | 'voice'; completedAt: string; durationSeconds: number; turns: Turn[] };
  scores: DriveScore[];                           // all five, in D R I V E order
  english: EnglishMetrics;                        // speech measures are null in text mode
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

interface QualityCheck {                          // draft, M5
  qualityCheckId: string;
  kind: 'interview' | 'calibration';
  createdAt: string;
  interviewId?: string;
  interviewerRef?: string;
  interviews?: number;
  talkShare?: { interviewer: number; candidate: number };   // share of speaking time, from the transcript
  drift?: { competency: Competency; interviewerMean: number; panelMean: number; delta: number }[];
  signals: {
    kind: 'leading_question' | 'off_limits_question' | 'coverage_gap' | 'scale_drift';
    message: string;
    recommendation: string;
    competencies?: Competency[];
    evidence?: Evidence[];
  }[];                                            // signals and recommendations, never a verdict about a candidate
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
| `TURN_IN_FLIGHT` | 409 | a turn while the previous one is still being answered |
| `SCORES_ALREADY_SAVED` | 409 | new interviewer scores after the first save |
| `DRAFT_LOCKED` | 409 | the draft requested before the interviewer's scores exist |
| `TRANSCRIPT_MISSING` | 409 | a draft or an interview check before the transcript exists |
| `TRANSCRIPT_EXISTS` | 409 | a second recording for an interview that already has a transcript |
| `CONSENT_REQUIRED` | 400 | a recording uploaded without `consent=true` |
| `AI_INVALID_OUTPUT` | 502 | the ML service failed schema or evidence checks after its one retry |
| `AI_UNAVAILABLE` | 503 | the ML service is down |
| `AI_BUDGET_EXCEEDED` | 503 | the gateway refused: `BUDGET_USD_CAP` reached |

## Which ML call each endpoint makes

`api` always sends `toLLMView()` output, never the snapshot (`docs/SPEC.md`, section 6).

| Public endpoint | ML endpoint | `api` stores |
| --- | --- | --- |
| `POST /v1/briefs` | `POST /internal/v1/brief` | the brief |
| `POST /v1/simulations` | `GET /internal/v1/scenarios/:id`, then `POST /internal/v1/simulation/turn` with no turns | the simulation and the opening turn |
| `POST /v1/simulations/:id/turns` | `POST /internal/v1/simulation/turn` with the whole transcript | both turns, the director's decision (audit only, never returned) |
| `POST /v1/simulation-assessments` | `POST /internal/v1/simulation/assessment` | scores, English, questions and feedback — feedback served separately |
| `POST /v1/interviews/:id/recording` | `POST /internal/v1/interview/transcribe` | the transcript; **the audio is deleted** once it is stored |
| `POST /v1/interviews/:id/assessment-draft` | `POST /internal/v1/interview/draft` with the transcript and notes — never the interviewer's scores | the draft |
| `POST /v1/quality-checks/*` | `POST /internal/v1/quality-check` — for an interview, with its transcript | the check |

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
- a turn while one is in flight → `409 TURN_IN_FLIGHT`.
