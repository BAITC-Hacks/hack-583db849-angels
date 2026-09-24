# Working in this repository

Four people, each in their own part of the repository, each working down their own list of issues — and a `main` that nobody touches directly.

## The rules

1. **Never push to `main`.** It is protected on GitHub: direct pushes and force-pushes are refused for everyone, the owner included. Everything reaches `main` through a pull request.
2. **One branch per person per slice.** Branches are named after the slice and the part of the system:

   | Part | Owner | Branch pattern | Example |
   | --- | --- | --- | --- |
   | Frontend (`apps/web`) | Meiyrbek | `feat/<slice>-web` | `feat/m2a-simulator-voice-web` |
   | Backend (`apps/api`) | Aibek | `feat/<slice>-api` | `feat/m2a-simulator-voice-api` |
   | ML (`services/ml`) | Nauryzbek | `feat/<slice>-ml` | `feat/m2a-simulator-voice-ml` |
   | Scenario stories (`docs/scenarios`) | Beknur | `docs/scenario-stories-<batch>` | `docs/scenario-stories-2-4` |

   Fixes use `fix/<slice>-<short-name>`, documentation `docs/<short-name>`.
3. **Stay in your own part.** Every issue belongs to one person and one part; nobody shares an issue, and nobody gets an issue outside their part. A pull request changes only its author's paths:

   | Who | Changes only |
   | --- | --- |
   | Aibek | `apps/api/**`, `docker-compose.yml`, the `# API` lines of `.env.example`, `pnpm-lock.yaml` for his own dependencies |
   | Nauryzbek | `services/ml/**`, `config/**`, `seed/**`, `fixtures/**`, the `# ML` lines of `.env.example` |
   | Beknur | `docs/scenarios/**` |
   | Meiyrbek | everything else: `apps/web/**`, `packages/**`, root files, `.github/**`, `docs/**` |

   A pull request that touches anything else is sent back. If you need something from another part, write it in your issue — never commit to someone else's branch or folder.
4. **Start every slice from fresh `main`:**
   ```bash
   git switch main && git pull
   git switch -c feat/<slice>-<part>
   ```
5. **The contract is written already, and it is frozen.** `docs/contracts/` holds every shape with an example, so each part is built against it alone:
   - **API:** a slice's first pull request is its own DTOs and `apps/api/openapi.json`, answering with the examples until the implementation lands;
   - **ML:** the stubs from #4 answer every internal endpoint with its example, so the API never waits for a later ML slice;
   - **Web:** each screen runs on its preview until the API side of its slice is merged.

   If a shape looks wrong, say so in your issue and carry on with the rest. Meiyrbek changes the contract in a docs pull request, and only by adding to it. Generated clients are never committed — they are built from the neighbouring part's `openapi.json` — so a pull request that breaks a shape fails its own CI, and nobody has to fix someone else's code.
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

Each person works down their own list, top to bottom. Every issue repeats its place under **Order**: what comes before, what comes next, and whether it waits for anyone.

**Aibek — API** — step by step, with every endpoint, migration and test: [`docs/API-PLAN.md`](docs/API-PLAN.md)

| Step | Issue | Waits for other people |
| --- | --- | --- |
| 1 | #3 F0 — NestJS, Prisma, keys, `toLLMView`, candidates, `openapi.json`, Compose | `ai-client`, seed and Compose: the first pull request of #4 |
| 2 | #6 M2a — simulations, spoken turns, accommodation | — |
| 3 | #9 M3 — assessments, started on completion | — |
| 4 | #12 M1 — briefs, created automatically | — |
| 5 | #15 M4 — interviews, recording, blind scoring | — |
| 6 | #51 C — consistency before and after | — |
| 7 | #24, PR 1 — admin and demo endpoints | — |
| 8 | #18 M5 — quality checks | the final M5 contract, #17 PR 1 |
| 9 | #21 M2b — even assignment, the pool | — |
| 10 | #55 S — the surprise question | — |
| 11 | #24, PR 2 — `DEMO_MODE` end to end | #25 |

**Nauryzbek — ML**

| Step | Issue | Waits for other people |
| --- | --- | --- |
| 1 | #4 F0 — stubs for every endpoint, `openapi.json`, gateway, rubric, seed | — |
| 2 | #7 M2a — speech in and out, mini-ML, beat engine, actor, first scenario | — |
| 3 | #10 M3 — judge, evidence check, English metrics, quality bench | — |
| 4 | #13 M1 — brief with eight focuses and the before-interview consistency | — |
| 5 | #16 M4 — two-speaker transcription, interview draft | — |
| 6 | #52 C — consistency after the interview | — |
| 7 | #19 M5 — quality guard | the final M5 contract, #17 PR 1; if it is not there, do step 8 first |
| 8 | #22 M2b — scenarios 2–10 through the quality bench | Beknur's stories, #53, batch by batch |
| 9 | #56 S — the surprise question | — |
| 10 | #25 D — final cassettes, budget report | — |

**Meiyrbek — web, and review of everything**

| Step | Issue | Waits for other people |
| --- | --- | --- |
| 1 | #49 F0 — BFF, role cookie, mappers, generated client | the generated client: `apps/api/openapi.json` from #3 |
| 2 | #5 M2a — push-to-talk screen | connecting it: #6 PR 1 |
| 3 | #8 M3 — report and feedback on the API | #9 PR 1 |
| 4 | #11 M1 — brief with eight focuses | connecting it: #12 PR 1 |
| 5 | #17, PR 1 — the final M5 contract, by 26.09 | — |
| 6 | #14 M4 — interview on the API | #15 PR 1 |
| 7 | #50 C — commission consistency screen | connecting it: #51 |
| 8 | #23, PR 1 — homes, admin, the server | #24 PR 1 |
| 9 | #17, PR 2–3 — the quality panel | connecting it: #18 PR 1 |
| 10 | #20 M2b — scenario pool screen | #21 |
| 11 | #54 S — surprise question screens | connecting them: #55 PR 1 |
| 12 | #23, PR 2 — the pitch | — |

**Beknur — product**

| Step | Issue | Waits for other people |
| --- | --- | --- |
| 1 | #53 — stories for scenarios 2–10, in three batches by 24, 25 and 26.09 | — |

- **Nobody waits for another person's slice work.** The only waits are the ones in these tables, and each is on a single, early pull request.
- **Work ahead freely within your own list.** Blocked on a wait? Take your next step and come back.
- **A slice is finished when every part of it is in `main`** and the slice runs end to end. Then its milestone closes.

## How review works

1. You open a pull request and fill in "How it was checked".
2. Meiyrbek checks the list under **Done when** in the issue, the CI result, and that the pull request touches only your paths.
3. Anything wrong comes back as a review comment on the pull request, with the exact error. Fix it in the same branch and push again — the pull request updates itself.
4. When the parts run together and something breaks, Meiyrbek opens a bug issue with the part's label, assigned to its owner, with the steps and the error.

## Merge every day

A pull request is merged as soon as it is ready — never saved up for the end.

Integration on the last day is how a project like this fails: people build for a week on their own assumptions about each other's contracts, and on the final evening nothing fits. Merging daily keeps `main` runnable at every moment, so there is always a demo of whatever is done.

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

One issue per slice per part: #2 to #25 and #49 to #56. The title says which: `02-M2a · API · simulations…` — slice number, slice, part, the work. Slice numbers follow the order of work.

- **`Refs #N`** in a pull request that does part of an issue. **`Closes #N`** only in the pull request that finishes it: GitHub closes the issue automatically when that pull request is merged. Nobody closes issues by hand.
- **The plan comes first.** `docs/PLAN.md` is the one source of truth. When the plan changes, the change goes into `docs/PLAN.md` through a pull request first, and the issues are edited to match after. Two documents that disagree are worse than one that is slightly out of date.
- **Issues are never deleted.** One that is no longer needed is closed as *not planned*, with one line saying why. When slices move, check the **Order** sections that point at them.
- **A bug found during integration gets its own issue**, labelled with the part it belongs to.

## Who owns the shared files

A few files are touched by everyone. Each has one owner; anyone else changes it only through a pull request that owner reviews.

| File | Owner |
| --- | --- |
| Root `package.json`, `pnpm-workspace.yaml`, `.github/workflows/*` | Meiyrbek |
| `docker-compose.yml` — every block, `web` included | Aibek |
| `apps/api/prisma/schema.prisma`, `apps/api/openapi.json` | Aibek |
| `services/ml/**` including `services/ml/openapi.json`, `config/**` (rubric, models, scenarios, prompts), `seed/**`, `fixtures/**` | Nauryzbek |
| Each part's `Dockerfile` | the part's owner |
| `docs/scenarios/**` | Beknur |
| `docs/PLAN.md`, `docs/contracts/**`, `docs/SPEC.md`, `README.md`, `CONTRIBUTING.md` | Meiyrbek |

A new dependency that needs an `allowBuilds` line in `pnpm-workspace.yaml` adds only that line, in the same pull request, and says so.

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
