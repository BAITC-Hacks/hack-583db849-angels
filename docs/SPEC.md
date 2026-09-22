# SPEC — the interfaces the three parts build against

This is the agreement that lets web, api and ml be built in parallel without guessing. It fixes what crosses a boundary: ports, environment, the public and internal APIs, the shared schemas and the data files. Everything inside a part is up to its owner.

It changes only through a pull request that all three of us review. When it disagrees with code, the code is wrong until this file is changed.

The product and the plan are in [`PLAN.md`](PLAN.md). This file is the technical contract.

## 1. Versions

| Tool | Version | Pinned in (F0 adds the file) |
| --- | --- | --- |
| Node.js | 22 | `.nvmrc` |
| pnpm | 11.20.0 | `packageManager` in the root `package.json` |
| Python | 3.13 | `.python-version` |
| PostgreSQL | 16 | `docker-compose.yml` |

## 2. Services

| Service | Port | Owner | Reachable from |
| --- | --- | --- | --- |
| `web` — Next.js | 3000 | Meiyrbek | the browser |
| `api` — NestJS | 3001 | Aibek | the browser, inVision |
| `ml` — FastAPI | 8000 | Nauryzbek | **`api` only**, over the Compose network |
| `postgres` | 5432 | Aibek | `api` only |

The ML service is never exposed publicly. Only `api` calls it.

## 3. Environment

`.env.example` lists every variable. Who reads what:

| Variable | Read by | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | web | where the browser reaches `api` |
| `NEXT_PUBLIC_API_MODE` | web | `mock` (MSW) or `real` |
| `DATABASE_URL` | api | PostgreSQL connection |
| `API_KEYS` | api | demo clients as `key:role` pairs, comma-separated |
| `ML_SERVICE_URL` | api | where `api` reaches `ml` |
| `ML_INTERNAL_TOKEN` | api, ml | shared secret on every internal call |
| `DEMO_MODE` | api, ml | serve seed results for A, B and C without model calls |
| `OPENAI_API_KEY`, `DEEPGRAM_API_KEY` | ml only | provider keys |
| `GATEWAY_MODE` | ml | `live`, `record` or `replay` |
| `BUDGET_USD_CAP` | ml | the gateway refuses everything past this total |

Provider keys exist only in the ML service's environment. Neither `web` nor `api` ever holds them.

## 4. Public API conventions

The API inVision calls, served by `api`.

- **Base path** `/v1`. JSON in and out, field names in `camelCase`.
- **Authentication.** Every request carries `X-API-Key`, except `GET /v1/health`. The key maps to one role: `platform`, `interviewer`, `commission` or `admin`. `platform` is the key inVision's own system uses for candidate-facing calls. Missing or unknown key — `401`; known key, wrong role — `403`.
- **Idempotency.** Every creating `POST` accepts `Idempotency-Key`. The same key with the same body returns the resource created the first time, with its original status. The same key with a different body — `409` with code `IDEMPOTENCY_KEY_REUSED`. Keys are kept for 24 hours.
- **Errors** always have one shape, and clients branch on `code`, never on `message`:
  ```json
  { "error": { "code": "DRAFT_LOCKED", "message": "Save the interviewer's scores first.", "details": {}, "traceId": "a1b2c3" } }
  ```
- **Identifiers** are UUID v4 strings, except turn ids (section 6).
- **Timestamps** are ISO 8601 in UTC.

### Who may call what

| Endpoint group | `platform` | `interviewer` | `commission` | `admin` |
| --- | --- | --- | --- | --- |
| Candidates — create, list, progress (filtered by role) | yes | yes | yes | yes |
| M1 briefs | — | yes | yes | yes |
| M2 simulations | yes | yes | yes | yes |
| M3 assessments — read scores | — | — | yes | yes |
| M3 candidate feedback | yes | yes | yes | yes |
| M4 interviews, recording, interviewer scores, draft | — | yes | read | yes |
| M5 quality checks | — | — | yes | yes |
| S surprise question — create, start, answer | yes | — | — | yes |
| S surprise answer — transcript and video | — | yes | yes | yes |
| Admin overview, audit events, demo reset | — | — | — | yes |

An interviewer never sees the AI's scores: they score blind, and M4 shows the draft only after their own scores are saved. `platform` can never read a score, a brief or a draft, so the candidate cannot reach one through inVision's system. The candidate-feedback endpoint never returns a score, whoever calls it: inVision relays it to the candidate.

The endpoints, DTOs and error codes are in [`contracts/api.md`](contracts/api.md); the internal ML endpoints and models are in [`contracts/ml.md`](contracts/ml.md), with a JSON example of every call in [`contracts/examples/`](contracts/examples/). Each slice's contract pull request turns its part into code.

## 5. Internal ML API

Called only by `api`. Every request carries `X-Internal-Token: $ML_INTERNAL_TOKEN`; without it — `401`.

| Endpoint | From slice | Purpose |
| --- | --- | --- |
| `GET /internal/v1/health` | F0 | liveness |
| `GET /internal/v1/scenarios`, `/{scenarioId}` | M2a | the public part of a scenario |
| `POST /internal/v1/simulation/turn` | F0 stub, M2a real | the character's next line for a candidate turn |
| `POST /internal/v1/simulation/assessment` | F0 stub, M3 real | scores, English metrics, interview questions, candidate feedback |
| `POST /internal/v1/brief` | F0 stub, M1 real | the interviewer brief |
| `POST /internal/v1/transcribe` | M2a, M4, S | audio → turns by speaker; video never, audio track only |
| `POST /internal/v1/speech` | M2a | the character's voice |
| `POST /internal/v1/consistency` | C | claimed against measured, before and after the interview |
| `POST /internal/v1/surprise-question` | S | a question from the candidate's application |
| `GET /internal/v1/usage` | admin | live and replayed calls, spend and cap |
| `POST /internal/v1/interview/draft` | M4 | draft from the interview transcript |
| `POST /internal/v1/quality-check` | M5 | question quality and calibration signals |

**`api` owns storage and ids; `ml` owns content.** For a simulation turn, `api` assigns the candidate turn's id and sends the whole transcript; `ml` returns the character's line and the director's decision; `api` assigns the character turn's id and stores both.

**Types flow one way.** FastAPI exports its OpenAPI to `services/ml/openapi.json`, committed. `api` generates `apps/api/src/ai-client/schema.d.ts` from it with `openapi-typescript`. Whoever changes an ML schema regenerates both in the same pull request. F0 adds a CI step that fails when they drift.

## 6. Shared schemas

These shapes cross boundaries and are defined once. JSON below; Pydantic and TypeScript mirror it field for field.

### `CandidateSnapshot` — what inVision sends

```json
{
  "externalId": "inv-2026-000123",
  "profile": {
    "fullName": "…", "email": "…", "phone": "…", "iin": "…",
    "gender": "…", "region": "…", "school": "…", "familyIncome": "…", "photoUrl": "…"
  },
  "application": { "answers": [ { "fieldId": "motivation", "question": "Why inVision U?", "answer": "…" } ] },
  "test": { "answers": [ { "itemId": "block_03", "response": "…" } ] },
  "englishCertificate": { "type": "IELTS", "score": "6.5" }
}
```

**All personal data lives in `profile`, and only there.** That is what makes the privacy boundary checkable.

### `LLMView` — the only thing `ml` ever receives about a candidate

```json
{
  "candidateId": "5b0c…",
  "application": { "answers": [ { "fieldId": "motivation", "question": "Why inVision U?", "answer": "…" } ] },
  "test": { "answers": [ { "itemId": "block_03", "response": "…" } ] },
  "englishCertificate": { "type": "IELTS", "score": "6.5" }
}
```

`toLLMView()` in `api`:
1. drops `profile` entirely and replaces `externalId` with the internal `candidateId`;
2. replaces every occurrence of a `profile` value inside answer text — a candidate writing their own name, email, phone or IIN — with `[redacted]`.

In `ml`, the Pydantic model has no `profile` field and sets `extra="forbid"`: a request carrying one fails validation.

### `Turn`

```json
{ "turnId": "turn_04", "speaker": "candidate", "text": "…", "startedAt": "2026-09-25T10:04:00Z", "endedAt": "2026-09-25T10:04:21Z" }
```

`speaker` is `candidate` or `character`. `turnId` is `turn_` plus a two-digit position, unique within one simulation; with the simulation id it is unique everywhere.

### `Evidence` and `Claim`

```json
{
  "claim": "Candidate described a concrete recovery plan after failure.",
  "evidence": [ { "source": "simulation_turn", "sourceId": "turn_04", "quote": "I spoke with the team, changed the timeline and assigned owners." } ]
}
```

| `source` | `sourceId` points at |
| --- | --- |
| `application_field` | an `application.answers[].fieldId` |
| `test_item` | a `test.answers[].itemId` |
| `simulation_turn` | a `turnId` |
| `interview_note` | an interview note id |
| `interview_turn` | a turn of the interview transcript, `iturn_NN` (M4, M5) |
| `surprise_answer` | a segment of the surprise answer transcript, `sseg_NN` (S) |

### `DriveScore`

```json
{ "competency": "E", "score": 3, "confidence": "medium", "rationale": "…", "evidence": [ /* Evidence */ ] }
```

- `competency` is one of `D`, `R`, `I`, `V`, `E`.
- `score` is an integer `0–4`, or `null` when there is not enough verified evidence.
- `confidence` is `low`, `medium` or `high`.
- **A non-null score always has at least one verified piece of evidence.**

### `EnglishMetrics` — always a separate block, never mixed into D.R.I.V.E.

```json
{ "wordsPerMinute": 118, "fillerRate": 0.04, "meanTurnLength": 31.5, "lexicalDiversity": 0.62, "grammarErrorsPer100Words": 2.1, "cefrEstimate": "B2" }
```

## 7. Evidence verification

Implemented once, in `services/ml/app/evidence/`, and used by every module that returns evidence.

1. Look up the source named by `source` and `sourceId`.
2. Normalise both the quote and the source text: collapse runs of whitespace to one space, turn curly quotes and apostrophes into straight ones. Nothing else — case and punctuation count.
3. The normalised quote must be a substring of the normalised source. If not, drop that piece of evidence and log it.
4. A score left with no evidence becomes `null`.
5. If more than half of a response's evidence was dropped, the response is rejected: one retry, then an error.

## 8. Data files

### Seed — `seed/`

```
seed/candidates/a/  snapshot.json  expected-brief.json  transcript.json
                    expected-assessment.json  interview-notes.json  interviewer-scores.json
seed/candidates/b/  …the same files…
seed/candidates/c/  …the same files…
seed/quality-history.json   interview questions and score history for M5
```

Candidates A, B and C have fixed ids, so every part refers to the same person:

| Candidate | `candidateId` |
| --- | --- |
| A | `00000000-0000-4000-8000-00000000000a` |
| B | `00000000-0000-4000-8000-00000000000b` |
| C | `00000000-0000-4000-8000-00000000000c` |

Their `profile` blocks are synthetic, and obviously so.

### Cassettes — `fixtures/cassettes/`

```
fixtures/cassettes/<task>/<sha256>.json
```

The key is the SHA-256 of the provider, the model, the prompt file's content and the request body. In `replay` mode a missing cassette is an error — the gateway never falls back to a live call.

## 9. Where the public contract comes from

NestJS DTOs with `@nestjs/swagger` produce `apps/api/openapi.json`, committed. `packages/api-client` is generated from it with `openapi-typescript`, and the web app calls the API only through that client. MSW mock fixtures in `apps/web` are validated against the same file. As with the ML types, CI regenerates and fails on drift.
