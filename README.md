# AI Leader ID — the interview layer for inVision U

An AI layer that sits around the admissions interview at [inVision U](https://invisionu.education). It does not replace any part of inVision's existing system — registration, application form, test, video interview, candidate statuses and commission decisions all stay where they are. It takes a candidate snapshot over a JSON API and returns explainable material for the people who decide.

**A human always makes the decision.** There is no `accept` or `reject` anywhere in the API.

| Module | What it gives | To whom |
| --- | --- | --- |
| **M1 · Interview brief** | Questions per D.R.I.V.E. competency, contradictions worth asking about, the English gap | Interviewer, before the meeting |
| **M2 · Leadership simulator** | A spoken role-play in English where the candidate handles a real workplace situation | Candidate |
| **M3 · Simulation judge** | D.R.I.V.E. scores `0–4` or `null`, each with a quote and the turn it came from; English measured separately | Commission |
| **M4 · Post-interview draft** | An AI draft and where it disagrees with the interviewer — released only after the interviewer has saved their own scores | Interviewer |
| **M5 · Calibration & Question Quality Guard** | Leading questions, uneven D.R.I.V.E. coverage, an interviewer's drift on the scale — signals and recommendations, never a verdict | Commission |

The candidate gets developmental feedback after the simulation: no scores, no ranking, no hint of a decision.

**Scope for the pitch.** M2 and M3 are built as one complete, provable product. M1, M4 and M5 are thin but real API demonstrations.

## Principles

- Every AI claim carries evidence — a verbatim quote and its source — and code checks that every quote really is in that source. A score left without verified evidence becomes `null`, never a low score.
- No personal data reaches a model. Names, IINs, contact details, photos, gender, region, school and family income are stripped before anything leaves the API.
- English is scored apart from leadership. Language mistakes never lower a D.R.I.V.E. score.
- The interviewer scores blind. The server refuses to generate or show the AI draft until their own scores are saved.
- Integration is JSON in, JSON out, with an `X-API-Key` per client and an `Idempotency-Key` on every creating request. Scenarios, rubric and model choices live in configuration, not in code.
- Cheap by design: every model call goes through one gateway with caching, cost logging and a hard budget cap.

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
inVision U / demo stand ──JSON API──▶ NestJS API ──internal API──▶ FastAPI ML service ──▶ OpenAI · Deepgram
                                      contracts, privacy,           gateway, cache, schema
                                      storage, audit, access rules  validation, cost log, M1–M5
```

## Status

The plan is agreed and the repository is being set up. There is no runnable code yet — the foundation slice is next. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan (in Russian): modules, API, the simulator design, slices, owners and the calendar.

## Team

| | Role |
| --- | --- |
| Meiyrbek | Tech lead, frontend |
| Aibek | Backend |
| Nauryzbek | ML |
| Beknur | Product manager |

## Working here

Nobody pushes to `main`. Every change arrives through a pull request from a personal branch. The rules are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

Coding agents (Claude Code, Codex and others) follow [`AGENTS.md`](AGENTS.md).

Only synthetic data is used anywhere in this repository.
