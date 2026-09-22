# Working in this repository

Three people, three personal branches per slice, and a `main` that nobody touches directly.

## The rules

1. **Never push to `main`.** It is protected on GitHub: direct pushes and force-pushes are refused for everyone, the owner included. Everything reaches `main` through a pull request.
2. **One branch per person per slice.** Branches are named after the slice and the part of the system:

   | Part | Owner | Branch pattern | Example |
   | --- | --- | --- | --- |
   | Frontend (`apps/web`) | Meiyrbek | `feat/<slice>-web` | `feat/m2-simulator-web` |
   | Backend (`apps/api`) | Aibek | `feat/<slice>-api` | `feat/m2-simulator-api` |
   | ML (`services/ml`) | Nauryzbek | `feat/<slice>-ml` | `feat/m2-simulator-ml` |

   Fixes use `fix/<slice>-<short-name>`, documentation `docs/<short-name>`.
3. **Stay in your own branch.** If you need something from another person's part, ask for it in their pull request or in the team chat — do not commit to their branch.
4. **Start every slice from fresh `main`:**
   ```bash
   git switch main && git pull
   git switch -c feat/<slice>-<part>
   ```
5. **Contract first.** A slice begins with one small pull request that only adds the contract — NestJS DTOs, Pydantic schemas, generated types, mock fixtures. Once it is merged, all three parts are built in parallel against it, and the frontend works on mocks until the real endpoint lands.
6. **Keep pull requests small and reviewable.** One pull request is one coherent outcome. Say in the description what it does, how to check it, and what it deliberately leaves out.
7. **Meiyrbek approves every pull request before it is merged.** `.github/CODEOWNERS` names only Meiyrbek, so GitHub accepts no other approval. Meiyrbek's own pull requests are merged by Meiyrbek, once the checks pass. Anyone may still review, comment and ask for changes on any pull request — that is welcome; it just does not unlock the merge.
8. **Keep your branch current.** Rebase on `main` before asking for review:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
   Force-pushing your *own* branch is fine; force-pushing anything else is not.

## Order of work

Slices are done in priority order, and each of us works down our own column:

| Slice | Web — Meiyrbek | API — Aibek | ML — Nauryzbek |
| --- | --- | --- | --- |
| 01 · F0 Foundation | #2 | #3 | #4 |
| 02 · M2a Simulator, text | #5 | #6 | #7 |
| 03 · M3 Judge | #8 | #9 | #10 |
| 04 · M1 Brief | #11 | #12 | #13 |
| 05 · M4 Interview draft | #14 | #15 | #16 |
| 06 · M5 Quality Guard | #17 | #18 | #19 |
| 07 · M2b Simulator, voice | #20 | #21 | #22 |
| 08 · Demo | #23 | #24 | #25 |

- **Within a slice the three parts run in parallel.** The API contract pull request comes first; everyone builds against it.
- **Work ahead by one slice at most.** Waiting for a review on slice 02 is a good moment to start 03 — not 06.
- **F0 (#2, #3, #4) is merged in the first two days**, before anything else: every later slice stands on it.
- **A slice is finished when all three parts are in `main`** and the slice runs end to end. Then its milestone closes.

## Merge every day

A pull request is merged as soon as it is ready — never saved up for the end.

Integration on the last day is how a project like this fails: three people build for a week on their own assumptions about each other's contracts, and on the final evening nothing fits. Merging daily keeps `main` runnable at every moment, so there is always a demo of whatever is done.

That only works if pull requests are small. Aim for a few hundred changed lines at most, so a review takes minutes and happens the same day.

## Local verification

CI runs lint, types, tests and the build. It does not start the stack, so anything that only breaks when the parts talk to each other reaches `main` unnoticed unless someone runs it.

- **Before opening a pull request that touches the API, the database, Docker or an integration between parts**, run its tests and checks locally.
- **If `docker-compose.yml` exists, bring the stack up, check it and bring it down:**
  ```bash
  docker compose up --build -d
  docker compose ps          # every service up and healthy
  # call each service's health endpoint and the endpoints you changed
  docker compose down
  ```
- **Write the commands and their results in the pull request, under "How it was checked".** "Works on my machine" is not a result; `POST /v1/simulations → 201` is.

## Issues

There is one issue per slice per part, #2 to #25. The title says which: `02-M2a · API · simulations module…` — slice number, slice, part, the work.

- **`Refs #N`** in a pull request that does part of an issue, such as the contract. **`Closes #N`** only in the pull request that finishes it: GitHub closes the issue automatically when that pull request is merged. Nobody closes issues by hand.
- **The plan comes first.** `docs/PLAN.md` is the one source of truth. When the plan changes, the change goes into `docs/PLAN.md` through a pull request first, and the issues are edited to match after. Two documents that disagree are worse than one that is slightly out of date.
- **Issues are never deleted.** One that is no longer needed is closed as *not planned*, with one line saying why. When slices move, check the "Depends on" lines in the issues that point at them.
- **A bug found during integration gets its own issue**, labelled with the part it belongs to.

## Who owns the shared files

A few files are touched by everyone. Each has one owner; anyone else changes it only through a pull request that owner reviews.

| File | Owner |
| --- | --- |
| Root `package.json`, `pnpm-workspace.yaml`, `.github/workflows/*` | Meiyrbek |
| `docker-compose.yml`, `apps/api/prisma/schema.prisma` | Aibek |
| `services/ml/**`, `config/**` (rubric, models, scenarios, prompts), `seed/**`, `fixtures/**` | Nauryzbek |
| `docs/PLAN.md`, `README.md`, `CONTRIBUTING.md` | Meiyrbek |

## Commits

Conventional Commits, in English, saying what changed and why: `feat: stream the character's reply while it is being synthesised`, `fix: refuse the draft before the interviewer's scores exist`. Not `update`, `changes` or `final`.

## Code and language

- Code, identifiers and comments are in English. The simulation is in English.
- Candidate screens and the stand are English only. Interviewer, commission and admin screens are English or Russian; a text added to them is added in both. Candidate quotes are never translated.
- Every model call goes through the ML gateway. Nothing calls OpenAI or Deepgram directly.
- Model output is validated against a schema. On invalid output: one retry, then a clear error.
- Personal data never leaves the API towards the ML service: everything goes through `toLLMView()`.

## Budget

- Everyone works with `GATEWAY_MODE=replay` by default: answers come from `fixtures/cassettes/` and cost nothing.
- Live calls run only on separate OpenAI project keys, each with its own spending limit — Meiyrbek's and Nauryzbek's. Aibek works on replay.
- Every task in `config/models.json` has a per-request cost limit, and the gateway refuses everything past `BUDGET_USD_CAP`.

## Secrets and data

This repository is public, so a mistake here is published the moment it is pushed.

- API keys live only in `.env`, which is never committed. `.env.example` lists every variable with no values. The keys are held by Meiyrbek.
- GitHub secret scanning and push protection are on: a push containing a key is refused by the server. The foundation slice adds a second secret scan to CI.
- Only synthetic candidates, anywhere — code, fixtures, screenshots, demos. Recordings of a real person's voice are never committed.
