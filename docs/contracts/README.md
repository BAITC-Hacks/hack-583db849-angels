# Contracts for M1–M5

The shapes the web screens already render, written down so the API and the ML service can be built to fit them. Each person has one file:

| For | File | What is in it |
| --- | --- | --- |
| **Aibek** — `apps/api` | [`api.md`](api.md) | the public `/v1` endpoints, DTOs, roles, error codes, which ML call each endpoint makes, the tests the rules need |
| **Nauryzbek** — `services/ml` | [`ml.md`](ml.md) | the internal `/internal/v1` endpoints, paste-ready Pydantic models, the rules the screens rely on |

[`examples/candidate-a/`](examples/candidate-a/) holds a JSON example of every request and response for candidate A: the public API at the top level, the internal ML API under `ml/`, plus candidate A's `snapshot.json` for the seed. They are generated from the web previews, so they are exactly what the screens show today.

The step-by-step plan for wiring the web to these endpoints — who, in which order, how to avoid conflicts — is [`docs/INTEGRATION.md`](../INTEGRATION.md).

**Checked before this was merged:**
- every public example satisfies the DTOs in `api.md` under strict TypeScript;
- every ML example validates against the Pydantic models in `ml.md`;
- the models refuse a profile field, interviewer scores in a draft request, a score without evidence, a score of 5, a character line over 60 words, a scenario that cannot show all five competencies and a brief that skips one of its eight focuses;
- [`examples/candidate-a/ml/scenario-config.conflict-resolution.json`](examples/candidate-a/ml/scenario-config.conflict-resolution.json) is the template for all ten scenarios: beats, answer types with example phrases for the mini-ML, fallback branches;
- every quote in an ML response appears word for word in its request.

**Which one wins.** These files are frozen targets. Each generated OpenAPI must match them field for field; a difference is a bug in that pull request, unless this folder was changed first — in a docs pull request from Meiyrbek, and only by adding. That is what lets web, api and ml each be built alone, without waiting for each other. Conventions shared by both — auth, idempotency, errors, the shared schemas, evidence checking — stay in `docs/SPEC.md`.
