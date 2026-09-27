# apps/web

The Next.js frontend. Candidate screens and the stand are English only; interviewer, commission and admin screens switch between English and Russian in the sidebar. A candidate's quote is never translated.

## Screens

`/` opens the home of the role chosen in the sidebar. Every product screen reads the real API.

| Route | Who | What it is |
| --- | --- | --- |
| `/interviewer` | interviewer | home: candidates and where each one is |
| `/interviewer/brief`, `/interviewer/brief/:candidateId` | interviewer | M1 brief, with the before-interview consistency, the surprise answer and the presentation |
| `/interviewer/schedule`, `/interviewer/schedule/call/:slotId` | interviewer | V: the week calendar, and the video call with the brief's questions, notes and blind scores |
| `/interviewer/interview`, `/interviewer/interview/:interviewId` | interviewer | M4: recording, transcript, blind scores, then the draft |
| `/commission` | commission | home |
| `/commission/simulation-report`, `/commission/simulation-report/:assessmentId` | commission | M3 report; every quote opens its turn |
| `/commission/consistency/:candidateId` | commission | C after the interview |
| `/commission/quality-guard` | commission | M5: interview checks and calibration |
| `/admin` | admin | system tiles (ML, mode, budget), audit log, demo reset |
| `/admin/scenarios` | admin | the scenario pool: status and how often each was assigned |
| `/demo/candidates` | admin | the demo's overview of A, B and C |
| `/demo/kit` | — | reference page for the evidence components; not linked |
| `/candidate` | candidate | home: progress through the four steps, the interview, what comes next — no score |
| `/simulation`, `/simulation/:sessionId` | candidate | M2, press-speak-release |
| `/feedback`, `/feedback/:assessmentId` | candidate | M3 feedback, no score |
| `/candidate/surprise/:surpriseId` | candidate | S: one question, one attempt, 90 s on camera |
| `/candidate/presentation` | candidate | P: one to three minutes on camera |
| `/candidate/interview`, `/candidate/interview/call/:slotId` | candidate | V: booking a time, then the call |
| `/stand/*` | — | the demo stand that plays inVision's platform — sign-in, registration, application, test, submission — on MSW mocks |
| `/health` | — | liveness for Docker and Compose |

The stand hands a finished application to the AI layer: "Send my application" on `/stand/application/submit` posts the snapshot to `POST /v1/candidates` under the platform key, and "Continue" opens `/candidate` as that applicant.

## How the web reaches the API

```
browser ──/api/v1/*──▶ Next.js route handler (BFF) ──X-API-Key──▶ API_INTERNAL_URL
```

- **The browser never holds a key.** `app/api/v1/[...path]/route.ts` adds the key for the role in the `invision-demo-role` cookie (`lib/api/serverKeys.ts`, from the `WEB_API_KEY_*` variables) and forwards the request as it is: method, body (multipart streamed), `Idempotency-Key`, status and response body. The `invision-demo-candidate` cookie says which candidate the candidate role is.
- **Types are generated.** `@invision/api-client` is built from `apps/api/openapi.json` before `dev`, `lint`, `typecheck`, `test` and `build`, and is never committed. `lib/api/mappers/` turns each response into the shape a screen shows.
- **TanStack Query** (`lib/api/QueryProvider.tsx`): data stays fresh for 5 s; a `GET` is retried at most twice, only on a network error or a `5xx`, never on a `4xx`; a mutation is never retried by itself. "Try again" resends the same `Idempotency-Key`, so a repeat cannot create a duplicate.
- **Errors are shown by `code`, never by `message`.** `lib/api/errors.ts` holds the text for each code in English and Russian — English only for a candidate — and shows the `traceId` small, so it can be read out.

## Run

```bash
pnpm install
pnpm --filter @invision/web dev      # http://localhost:3000
```

Product screens need the API at `API_INTERNAL_URL` (`http://localhost:3001` by default) and the four `WEB_API_KEY_*` values that match its `API_KEYS`. The stand needs nothing: with `NEXT_PUBLIC_API_MODE=mock` it answers in the browser through MSW.

## Checks

```bash
pnpm --filter @invision/web lint
pnpm --filter @invision/web typecheck
pnpm --filter @invision/web test
pnpm --filter @invision/web build
```
