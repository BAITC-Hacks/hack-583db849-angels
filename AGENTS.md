# Instructions for AI agents

Read this before changing anything in this repository. It applies to every coding agent — Claude Code, Codex and any other. A human's instruction in the current conversation takes precedence over this file.

## What this project is

AI Leader ID is an AI layer **around the admissions interview** at inVision U. inVision already has registration, the application form, the test, the video interview, candidate statuses and commission decisions. We build what they do not have, and it plugs into their system through a JSON API:

- **M1** — a brief for the interviewer before the meeting;
- **M2** — a spoken leadership role-play in English (the simulator);
- **M3** — a judge that scores the simulation transcript with quotes;
- **M4** — a post-interview draft, released only after the interviewer's own scores;
- **M5** — Calibration & Question Quality Guard for the interview process.

The sign-in, application and test screens in `apps/web` are a **demo stand** that plays the part of inVision's platform. They are not the product. Do not rebuild or extend them beyond what a task explicitly asks.

**Read these first:**
- [`docs/PLAN.md`](docs/PLAN.md) — the plan and the one source of truth (in Russian);
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how work moves through branches, pull requests and issues. Follow it; this file only adds what is specific to agents;
- the issue you are working on.

## Rules that are never broken

1. **A human makes every decision.** No automatic accept, reject, ranking or verdict — not in the API, not in the interface, not in a variable name.
2. **Every AI claim carries verified evidence.** Evidence is a verbatim quote plus its source: a form field, a turn id, a timestamp. Code checks that every quote really appears in its source. A score left without verified evidence is `null` — never a low score.
3. **No personal data reaches a model.** Names, IINs, email, phone, photos, gender, region, school and family income never leave the API towards the ML service. Everything goes through `toLLMView()` in NestJS, and the ML service's input schemas forbid extra fields.
4. **English is scored apart from leadership.** Language mistakes never change a D.R.I.V.E. score; English metrics are a separate block.
5. **The interviewer scores blind.** The server refuses to generate or return the M4 draft (`409`) until the interviewer's own scores are saved. This is a server rule, not a hidden button.
6. **The candidate never sees a score** or any hint of a decision — only developmental feedback after the simulation.
7. **M5 shows signals and recommendations, never verdicts.** It is not "bias detection" and says nothing about any candidate.

If a task seems to require breaking one of these, stop and ask.

## Git: what an agent may and may not do

- **Never push to `main`, and never try to.** It is protected; everything reaches it through a pull request that a human merges.
- **Work only on the branch of the issue you were given** — the issue names it, for example `feat/m2a-simulator-text-api`. Never commit to another person's branch. If the branch does not exist, create it from fresh `main`.
- **Never touch changes you did not make** — other people's commits, or uncommitted edits already in the working tree. Do not revert, reformat, stash or overwrite them; if they are in your way, stop and ask.
- **Open pull requests from that branch into `main`.** Put `Refs #N` for part of an issue and `Closes #N` only on the pull request that finishes it.
- **Do not merge pull requests.** Humans review and merge.
- **Force-push only your own branch, and only with `--force-with-lease`.** Never rewrite anyone else's history.
- **Do not create, close or re-scope issues on your own.** Check the existing issues first — duplicates are not wanted — and ask before opening a new one.
- **Small, coherent pull requests.** A few hundred changed lines at most. Say what the change does, how it was checked and what it leaves out.
- **Conventional Commits in English** that say what changed and why. Not `update`, `changes` or `final`.

## Before you write code

1. Read the issue and the plan section it points to.
2. Describe the plan in a few lines: which files you will touch and why.
3. **Wait for the human to confirm** before a large or cross-cutting change.
4. **Start a slice with its contract:** NestJS DTOs, Pydantic schemas, generated types and mock fixtures, in one small pull request before any implementation.
5. Do not change the stack, and do not add a significant dependency without agreement.

## Where things live

```
apps/web/            Next.js — demo screens, English only
apps/api/            NestJS — public API, storage, access rules, toLLMView, audit
services/ml/         FastAPI — gateway, M1–M5 logic, evidence check, English metrics
config/              rubric.drive.json, models.json, scenarios/*.json, prompts/*.md
seed/                synthetic candidates A, B, C and their expected results
fixtures/cassettes/  recorded model and speech responses for replay
docs/PLAN.md         the plan
```

Backend code goes only in `apps/api`, ML code only in `services/ml`. No model logic in the API, no storage or access rules in the ML service.

Prompts live in `config/prompts/*.md`, never as strings in code. Scenarios, the rubric and model choices live in `config/`, never hard-coded.

## Model calls

- **Every LLM, speech-to-text and text-to-speech call goes through the ML gateway.** Nothing in `apps/web` or `apps/api` calls OpenAI or Deepgram directly.
- **The API reaches the ML service only through `ai-client`, and sends only what `toLLMView()` returns.** Never build an ML request from a raw candidate record.
- **Model output is JSON validated against a schema.** On invalid output: one retry, then a clear error.
- **`max_tokens` is always set.** A character's line in the simulator is at most 60 words.
- **Send text to models, not audio.** Audio goes to speech recognition only.
- **Contracts are generated, not written by hand.** No handwritten copies of wire types, no untyped `fetch` to our own endpoints.

## Money and the network

The whole API budget is about $20.

- **Default to `GATEWAY_MODE=replay`.** Tests, CI and routine development run on recorded responses in `fixtures/cassettes/`.
- **Never make live calls in a loop, in tests or in CI.** Live calls happen only when a human asks for them, on a key with its own spending limit.
- **Never commit `.env` or a key.** This repository is public, and push protection will refuse a key anyway.
- Everything on the demo path must run with `GATEWAY_MODE=replay` and no network: the pitch cannot depend on the venue's Wi-Fi.

## Data

- **Only synthetic data**, everywhere: code, fixtures, screenshots, demos.
- **Personal data stays out of the ML service, logs, error messages and fixtures.** Log and report the candidate id, never a profile field.
- **Never read, print or log `.env` or any key.** For variable names, read `.env.example`. If a command would echo a secret, do not run it.
- **Never commit a recording of a real person's voice.** Audio outside `fixtures/` is ignored by git on purpose.

## Scope

- **M2 and M3 are built as one complete, provable product.** M1, M4 and M5 stay thin but real. Do not gold-plate the thin modules.
- **M2 works as text first.** Voice is a later stage (M2b) and must never break text mode.

## Do not

- Rebuild registration, the application form or the test.
- Build realtime speech-to-speech — only "press, speak, release" turns.
- Use a game engine.
- Build document verification.
- Show a candidate any score.
- Send anything that looks like real personal data to a free-tier API.

## Language

- Code, identifiers, comments, commit messages and the interface are in English.
- The simulation is in English.
- `docs/PLAN.md` is in Russian — read it; do not translate it unless asked.

## Tests

Every rule the server enforces has a test, written in the same pull request as the rule:

- the personal-data boundary on both sides: `toLLMView()` drops and redacts in NestJS, and the ML service rejects a request carrying a profile field;
- the M4 `409`, for generating **and** for reading the draft before the interviewer's scores exist;
- API key roles (`401`, `403`) and `Idempotency-Key` reuse;
- the evidence check: an invented quote is dropped and the score becomes `null`.

A server rule without a test is not done.

## Checks before a pull request

Run the checks for every part you touched before handing the work over, and report what you ran and what passed. Once the foundation slice lands, these are:

| Part | Checks |
| --- | --- |
| `apps/web`, `apps/api` | lint, typecheck, tests, build |
| `services/ml` | `pytest`, all on replay |
| everything | the CI secret scan |

The exact commands will be listed here when the foundation slice (F0) is merged. Until then, do not claim a check passed unless you actually ran it.

**If you touched the API, the ML service, the database, Docker or anything between two parts, and `docker-compose.yml` exists**, also run the stack:

```bash
docker compose up --build -d
docker compose ps          # every service up and healthy
# call each service's health endpoint and the endpoints you changed
docker compose down
```

Always bring the stack down afterwards, including when a check failed.

## Reporting

Say what you changed, what you verified and how, and what you did not do. List the exact commands you ran and their results. If a check failed, say so and show the error. Never describe work as done or tested when it was not.
