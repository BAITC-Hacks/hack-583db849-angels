# @invision/stand-client

The typed client for the **demo stand** — the screens under `/stand` in `apps/web` that play inVision's own platform: registration, the application form and the test.

It is frozen. `openapi.yaml` is the stand's contract as it was when the stand was built, and `src/generated/schema.d.ts` was generated from it. Neither is regenerated, and nothing in the AI layer uses them: the stand only needs to keep working on its mocks. `apps/web` tests validate those mocks against `openapi.yaml`.

The AI layer's own client is a different package, generated from `apps/api/openapi.json` — see `docs/SPEC.md`, section 9.
