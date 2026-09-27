# AI Leader ID — the interview layer for inVision U

An AI layer that sits around the admissions interview at [inVision U](https://invisionu.education). It does not replace any part of inVision's existing system — registration, application form, test, candidate statuses and commission decisions all stay where they are. It takes a candidate snapshot over a JSON API and returns explainable material for the people who decide.

**A human always makes the decision.** There is no `accept` or `reject` anywhere in the API.

| Module | What it gives | To whom |
| --- | --- | --- |
| **M1 · Interview brief** | Questions on the five D.R.I.V.E. competencies and on three more topics — what the candidate knows about inVision U, how good their English really is, how serious the motivation is — each with its source | Interviewer, before the meeting |
| **M2 · Leadership simulator** | A spoken role-play in English: the candidate handles a workplace situation with an AI character, one "press, speak, release" turn at a time | Candidate |
| **M3 · Simulation judge** | D.R.I.V.E. scores `0–4` or `null`, each with a verbatim quote and the turn it came from; English measured separately | Commission |
| **M4 · Post-interview draft** | A draft from the interview transcript and where it differs from the interviewer — released only after the interviewer has saved their own scores | Interviewer |
| **M5 · Calibration & Question Quality Guard** | Leading or off-limits questions, uneven D.R.I.V.E. coverage, an interviewer's drift against the panel — signals and recommendations, never a verdict | Commission |
| **C · Consistency** | What the candidate claimed against what was measured: in the brief before the interview, and for the commission after it | Interviewer, commission |

Around the modules are the candidate's own steps, which give the AI layer something to read:

| Step | What happens |
| --- | --- |
| **S · Surprise question** | One question written from the candidate's own application, one attempt, 90 seconds on camera |
| **P · Video presentation** | One to three minutes on camera, the same prompt for everyone |
| **V · Video interview** | The interviewer offers times, the candidate books one, and both join a video call from the browser (LiveKit). With the candidate's consent, the call's audio is recorded and transcribed for M4, C and M5 |

No video ever reaches a model: the audio is cut out and transcribed, and only the text goes on.

The candidate gets developmental feedback after the simulation: no scores, no ranking, no hint of a decision.

**Scope for the pitch.** M2 and M3 are built as one complete, provable product. M1, M4, M5, C, S, P and V are thin but real.

## Principles

- Every AI claim carries evidence — a verbatim quote and its source — and code checks that every quote really is in that source. A score left without verified evidence becomes `null`, never a low score.
- No personal data reaches a model. Names, IINs, contact details, photos, gender, region, school and family income are stripped before anything leaves the API.
- English is scored apart from leadership. Language mistakes never lower a D.R.I.V.E. score.
- The interviewer scores blind. The server refuses to generate or show the AI draft until their own scores are saved.
- Videos are for people only, and are deleted 30 days after the commission's decision date.
- Integration is JSON in, JSON out, with an `X-API-Key` per client and an `Idempotency-Key` on every creating request. Scenarios, rubric, prompts and model choices live in configuration, not in code.
- Cheap by design: every model call goes through one gateway with caching, cost logging and a hard budget cap. By default it replays recorded answers and spends nothing.

## D.R.I.V.E.

| Code | Competency |
| --- | --- |
| D | Disciplined Resilience |
| R | Responsible Innovation |
| I | Insightful Vision |
| V | Values-Driven Leadership |
| E | Entrepreneurial Execution |

## Architecture

```
browser ──▶ web (Next.js) ──X-API-Key──▶ api (NestJS) ──X-Internal-Token──▶ ml (FastAPI) ──▶ OpenAI · Deepgram
            BFF /api/v1/*                 contracts, toLLMView,              gateway: replay / record / live,
                                          storage, audit, access rules       cache, schema and quote checks,
inVision's platform ──X-API-Key──────▶    PostgreSQL                         cost log, M1–M5, C, S
                                              │
browser ◀──── video call ────▶ LiveKit ◀──────┘ room tokens only
```

The browser never holds a key: the web server adds it for the demo role. On the server only the web is public, behind Caddy with HTTPS.

## Running it

With Docker, from the repository root:

```bash
cp .env.example .env         # only the LIVEKIT_* values matter on a laptop
docker compose up --build
```

The web app is on http://localhost:3000 and the API on http://localhost:3001. The Compose file runs with `DEMO_MODE=true` and `GATEWAY_MODE=replay`: the ML service answers only from `fixtures/cassettes`, so the synthetic candidates A, B and C play through without keys or network. Switch roles in the sidebar; the admin's home has "Reset the demo".

A new applicant from the stand, or anything recorded live, has no recorded answer and needs the live mode with keys — see [`docs/DEPLOY.md`](docs/DEPLOY.md).

Without Docker, each part needs what its image installs:

| Part | Needs |
| --- | --- |
| web | Node 22, pnpm |
| api | Node 22, pnpm, PostgreSQL 16, and `ffprobe` from ffmpeg: it measures every spoken turn, and without it every turn is refused with `400` |
| ml | Python 3.13; the MiniLM model, fetched with `python services/ml/scripts/download_embedding_model.py config/embedding-model.json <dir>` and pointed to by `M2_EMBEDDING_MODEL_PATH`; Java 21 and LanguageTool 6.6 for the English metrics, pointed to by `M3_LANGUAGETOOL_DIR` — without them every assessment answers `503` |

The API and the ML service read their environment, not `.env`: export the variables first (`set -a; . ./.env; set +a`). Then, from the repository root:

```bash
pnpm install
PYTHONPATH="$PWD:$PWD/services/ml" python -m uvicorn services.ml.main:app --port 8000
pnpm --filter @invision/api exec prisma migrate deploy && pnpm --filter @invision/api dev
pnpm --filter @invision/web dev
```

The `e2e` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) starts the API and ML service this way on every pull request.

## Checks

| Part | Commands |
| --- | --- |
| web | `pnpm --filter @invision/web lint`, `typecheck`, `test`, `build` |
| api | `pnpm --filter @invision/api lint`, `typecheck`, `test`, `build` |
| ml | `cd services/ml && pip install -r requirements-dev.txt && python -m pytest -q` |
| the pitch path | on a running stack: `API=http://localhost:3001/v1 node scripts/e2e/pitch-path.mjs` — ends with `All steps passed.` |

CI runs all of these on every pull request, on replay and without keys, plus a secret scan.

## Status

As of 27 September 2026 every slice from the foundation to the surprise question is in `main`, and the whole pitch path passes offline in CI for A, B and C. Three of the ten scenarios have passed the quality bench and are in the pool; the other seven stay drafts until they do.

Open:
- [#23](https://github.com/mmeirbek/invisionu-new-chapter/issues/23) — the demo on the server and the laptop, and the pitch rehearsal;
- [#134](https://github.com/mmeirbek/invisionu-new-chapter/issues/134), [#135](https://github.com/mmeirbek/invisionu-new-chapter/issues/135), [#136](https://github.com/mmeirbek/invisionu-new-chapter/issues/136) — slice L: follow-up questions suggested beside the video call, from the candidate's last answer.

The pitch is on 1 October. The full plan (in Russian) is in [`docs/PLAN.md`](docs/PLAN.md).

## Documents

| File | What is in it |
| --- | --- |
| [`docs/PLAN.md`](docs/PLAN.md) | The plan and the one source of truth: decisions, modules, slices, status, risks (Russian) |
| [`docs/SPEC.md`](docs/SPEC.md) | The technical contract between the parts: ports, environment, conventions, shared schemas, data files |
| [`docs/contracts/`](docs/contracts/) | Every public and internal endpoint, with a JSON example of each call |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | The server, the laptop fallback, the pitch-path check (Russian) |
| [`docs/scenarios/`](docs/scenarios/) | The stories behind the simulator's scenarios |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How work moves through branches, pull requests and issues |
| [`AGENTS.md`](AGENTS.md) | The rules for coding agents |

## Team

| | Role |
| --- | --- |
| Meiyrbek | Tech lead: web, most of the API, review of everything |
| Aibek | Backend: the API foundation and the follow-ups in the call; the server and the rehearsal |
| Nauryzbek | ML |
| Beknur | Product manager: the scenario stories and the pitch |

## Working here

Nobody pushes to `main`. Every change arrives through a pull request from a personal branch. The rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

Coding agents (Claude Code, Codex and others) follow [`AGENTS.md`](AGENTS.md).

Only synthetic data is used anywhere in this repository.
