# apps/web

The Next.js frontend. English only.

| Route | What it is |
| --- | --- |
| `/demo/candidates` | where the demo starts: the three synthetic candidates and the path they walk |
| `/stand/*` | the demo stand that plays inVision's platform — sign-in, registration, application form, test, profile — on mock data |
| `/health` | liveness for Docker and Compose |

`/` redirects to `/demo/candidates`. Module screens (M1–M5) join as their slices land; see `docs/PLAN.md`, section 8.

## Run

```bash
pnpm install
pnpm --filter @invision/web dev      # http://localhost:3000
```

With `NEXT_PUBLIC_API_MODE=mock` (the default) the browser answers API calls itself through MSW; no backend is needed.

## Checks

```bash
pnpm --filter @invision/web lint
pnpm --filter @invision/web typecheck
pnpm --filter @invision/web test
pnpm --filter @invision/web build
```
