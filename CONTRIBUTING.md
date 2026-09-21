# Working in this repository

Three people, three personal branches per slice, and a `main` that nobody touches directly.

## The rules

1. **Never push to `main`.** It is protected on GitHub: direct pushes and force-pushes are refused for everyone, the owner included. Everything reaches `main` through a pull request.
2. **One branch per person per slice.** Branches are named after the slice and the part of the system:

   | Part | Owner | Branch pattern | Example |
   | --- | --- | --- | --- |
   | Frontend (`apps/web`) | Meiyrbek | `feat/<slice>-web` | `feat/m2-simulator-web` |
   | Backend (`apps/api`) | Nauryzbek | `feat/<slice>-api` | `feat/m2-simulator-api` |
   | ML (`services/ml`) | Beknur | `feat/<slice>-ml` | `feat/m2-simulator-ml` |

   Fixes use `fix/<slice>-<short-name>`, documentation `docs/<short-name>`.
3. **Stay in your own branch.** If you need something from another person's part, ask for it in their pull request or in the team chat — do not commit to their branch.
4. **Start every slice from fresh `main`:**
   ```bash
   git switch main && git pull
   git switch -c feat/<slice>-<part>
   ```
5. **Contract first.** A slice begins with one small pull request that only adds the contract — NestJS DTOs, Pydantic schemas, generated types, mock fixtures. Once it is merged, all three parts are built in parallel against it, and the frontend works on mocks until the real endpoint lands.
6. **Keep pull requests small and reviewable.** One pull request is one coherent outcome. Say in the description what it does, how to check it, and what it deliberately leaves out.
7. **Nobody merges their own pull request without a review from someone else.** The tech lead's pull requests are reviewed by Nauryzbek or Beknur.
8. **Keep your branch current.** Rebase on `main` before asking for review:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
   Force-pushing your *own* branch is fine; force-pushing anything else is not.

## Commits

Conventional Commits, in English, saying what changed and why: `feat: stream the character's reply while it is being synthesised`, `fix: refuse the draft before the interviewer's scores exist`. Not `update`, `changes` or `final`.

## Code and language

- Code, identifiers, comments and the interface are in English. The simulation is in English.
- Every model call goes through the ML gateway. Nothing calls OpenAI or Deepgram directly.
- Model output is validated against a schema. On invalid output: one retry, then a clear error.
- Personal data never leaves the API towards the ML service: everything goes through `toLLMView()`.

## Secrets and data

- API keys live only in `.env`, which is never committed. `.env.example` lists every variable with a placeholder. The keys are held by Meiyrbek.
- Only synthetic candidates, anywhere — code, fixtures, screenshots, demos.
