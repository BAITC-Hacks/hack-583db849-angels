## What this does

<!-- One or two sentences: the outcome, not the list of files. -->

Closes #<!-- issue number; use "Refs #N" instead if this does only part of it -->

## How it was checked

<!-- What you ran and what passed. Screenshots for anything visible. -->

- [ ] Lint, typecheck, tests and build pass for every part I touched
- [ ] Model calls in tests run on `GATEWAY_MODE=replay` — no live calls
- [ ] If this touches the API, the database, Docker or an integration between parts: the stack was brought up (`docker compose up --build -d`), the health and changed endpoints answered, and it was brought down — commands and results are written above

## Before asking for review

- [ ] The branch is rebased on the current `main`
- [ ] This pull request is from my own branch, and does one coherent thing
- [ ] No keys, no `.env`, no real personal data, no recordings of a real person
- [ ] If a contract changed: generated types and mock fixtures are updated in this same pull request

## Deliberately not in this pull request

<!-- What a reviewer might expect here but will not find, and why. -->
