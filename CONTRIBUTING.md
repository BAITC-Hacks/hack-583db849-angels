# Working in this repository

Four people, each in their own part of the repository, each working down their own issues — and a `main` that nobody touches directly.

## The rules

1. **Never push to `main`.** It is protected on GitHub: direct pushes and force-pushes are refused for everyone, the owner included. Everything reaches `main` through a pull request.
2. **One branch per person per slice.** Branches are named after the slice and the part of the system:

   | Part | Branch pattern | Example |
   | --- | --- | --- |
   | Frontend (`apps/web`) | `feat/<slice>-web` | `feat/l-follow-up-web` |
   | Backend (`apps/api`) | `feat/<slice>-api` | `feat/l-follow-up-api` |
   | ML (`services/ml`) | `feat/<slice>-ml` | `feat/l-follow-up-ml` |
   | The server | `feat/demo-deploy` | — |
   | Scenario stories (`docs/scenarios`) | `docs/scenario-stories-<batch>` | `docs/scenario-stories-2-4` |

   Fixes use `fix/<short-name>`, tests `test/<short-name>`, documentation `docs/<short-name>`. The issue names the branch.
3. **Stay in your own part.** Every issue belongs to one person and one part; nobody shares an issue. A pull request changes only the paths of its issue's part:

   | Who | Changes |
   | --- | --- |
   | Meiyrbek | `apps/web/**`, `packages/**`, `scripts/**`, root files, `.github/**`, `docs/**` apart from the two rows below; and `apps/api/**` together with Aibek |
   | Aibek | `apps/api/**`, `docker-compose*.yml`, `deploy/**`, `docs/DEPLOY.md`, the `# API` lines of `.env.example`, `pnpm-lock.yaml` for his own dependencies |
   | Nauryzbek | `services/ml/**`, `config/**`, `seed/**`, `fixtures/**`, the `# ML` lines of `.env.example` |
   | Beknur | `docs/scenarios/**` |

   A pull request that touches anything else is sent back. If you need something from another part, write it in your issue — never commit to someone else's branch or folder.

   **An issue can change hands.** When its owner cannot get to it in time, Meiyrbek reassigns it, and the issue says who owns it now and since when. That is how most API slices and a few ML ones were finished by Meiyrbek, and how #23 went to Aibek on 26.09. The new owner works in that issue's paths only.
4. **Start every slice from fresh `main`:**
   ```bash
   git switch main && git pull
   git switch -c feat/<slice>-<part>
   ```
5. **The contract comes first, and it is frozen.** `docs/contracts/` holds every shape with an example, so each part is built against it alone. A new slice starts the same way:
   - **Docs:** Meiyrbek's first pull request copies the slice's shapes into `docs/contracts/`, with the examples;
   - **ML:** the first pull request adds the Pydantic models, a stub that answers the example, and the regenerated `services/ml/openapi.json`;
   - **API:** the first pull request adds its DTOs and the regenerated `apps/api/openapi.json`, answering with the example until the implementation lands;
   - **Web:** the screen can be built on MSW until the API's first pull request is in `main`, and then moves to the API in its own pull request.

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

## Where the work stands

As of 27.09 every slice from 01 · F0 to 09 · S is in `main`, and the `e2e` job walks the whole pitch path for A, B and C on every pull request. Four issues are open:

| Issue | Owner | What | Waits for |
| --- | --- | --- | --- |
| #23 D · deploy | Aibek | the demo on the server and on the laptop, and the pitch rehearsal, by the evening of 30.09 | the server and the keys from Meiyrbek |
| #136 L · web | Meiyrbek | PR 1: the slice's contract in `docs/contracts/`; PR 2: the follow-up block beside the call on MSW; PR 3: the block on the API | PR 3 waits for #135 PR 1 |
| #134 L · ml | Nauryzbek | PR 1: schemas, stub and `openapi.json`; PR 2: the real follow-ups, seed and cassettes | — |
| #135 L · api | Aibek | PR 1: DTOs and `openapi.json`; PR 2: the implementation | PR 1 waits for #136 PR 1, PR 2 for #134 PR 1 |

- **Slice L must not put the pitch at risk.** `scripts/e2e/pitch-path.mjs` stays green with or without it.
- **Nobody waits for another person's slice work.** The only waits are the ones in this table, and each is on a single, early pull request.
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

CI runs lint, types, tests and the build for each part, a secret scan, and the `e2e` job: it starts the API and the ML service on replay, without Docker, and walks the pitch path through the public API. It does not build the Docker images, start the web against the API, or open a browser — so a broken image, proxy or screen reaches `main` unnoticed unless someone runs it.

- **Before opening a pull request that touches the API, the database, Docker or an integration between parts**, run its tests and checks locally.
- **Bring the stack up, check it and bring it down:**
  ```bash
  docker compose up --build -d
  docker compose ps          # every service up and healthy
  API=http://localhost:3001/v1 node scripts/e2e/pitch-path.mjs    # ends with "All steps passed."
  # call the endpoints you changed; open the screens you changed
  docker compose down
  ```
- **Write the commands and their results in the pull request, under "How it was checked".** "Works on my machine" is not a result; `POST /v1/simulations → 201` is.

## Issues

One issue per slice per part: #2 to #25, #49 to #56 and #134 to #136. The title says which: `02-M2a · API · simulations…` — slice number, slice, part, the work. Slice numbers follow the order of work, and each slice has a milestone.

- **`Refs #N`** in a pull request that does part of an issue. **`Closes #N`** only in the pull request that finishes it: GitHub closes the issue automatically when that pull request is merged. Nobody closes issues by hand.
- **The plan comes first.** `docs/PLAN.md` is the one source of truth. When the plan changes, the change goes into `docs/PLAN.md` through a pull request first, and the issues are edited to match after. Two documents that disagree are worse than one that is slightly out of date.
- **Issues are never deleted.** One that is no longer needed is closed as *not planned*, with one line saying why.
- **A bug found during integration gets its own issue**, labelled with the part it belongs to.

## Who owns the shared files

A few files are touched by everyone. Each has one owner; anyone else changes it only through a pull request that owner reviews.

| File | Owner |
| --- | --- |
| Root `package.json`, `pnpm-workspace.yaml`, `.github/workflows/*`, `scripts/e2e/*` | Meiyrbek |
| `docker-compose.yml`, `docker-compose.server.yml`, `deploy/Caddyfile`, `docs/DEPLOY.md` | Aibek |
| `apps/api/prisma/schema.prisma` and its migrations, `apps/api/openapi.json` | Aibek and Meiyrbek — migrations one branch at a time |
| `services/ml/**` including `services/ml/openapi.json`, `config/**` (rubric, models, scenarios, prompts, `prompts.lock.json`), `seed/**`, `fixtures/**` | Nauryzbek |
| Each part's `Dockerfile` | the part's owner |
| `docs/scenarios/**` | Beknur |
| `docs/PLAN.md`, `docs/contracts/**`, `docs/SPEC.md`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md` | Meiyrbek |

- `pnpm-lock.yaml` is never merged by hand: on a conflict, take `main`'s version, run `pnpm install` and commit.
- `apps/api/openapi.json` and `services/ml/openapi.json` are only ever exported from code; a test fails when either differs from it. On a conflict, regenerate.
- A new dependency that needs an `allowBuilds` line in `pnpm-workspace.yaml` adds only that line, in the same pull request, and says so.

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
- Live calls run only on separate project keys, each with its own spending limit. Meiyrbek holds the keys.
- Every task in `config/models.json` has a per-request cost limit, and the gateway refuses everything past `BUDGET_USD_CAP`.
- The prompts are frozen in `config/prompts.lock.json`: a prompt is part of every recorded answer's key, so changing one means re-recording its cassettes in the same pull request.
- `python services/ml/scripts/budget_report.py` shows what the recorded answers cost, by task. The providers' billing pages stay the total of record.

## Secrets and data

This repository is public, so a mistake here is published the moment it is pushed.

- API keys live only in `.env`, which is never committed. `.env.example` lists every variable with no values. The keys are held by Meiyrbek and are revoked after the pitch.
- GitHub secret scanning and push protection are on: a push containing a key is refused by the server. CI runs a second secret scan.
- Only synthetic candidates, anywhere — code, fixtures, screenshots, demos, the server. Recordings of a real person's voice are never committed.
