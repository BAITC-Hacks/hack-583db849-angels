# `@invision/api-client`

The typed client for our own API. `src/generated/schema.d.ts` is generated from
`apps/api/openapi.json` by `pnpm generate` and is **not committed**: every
check in `apps/web` regenerates it first, so the screens are always typed
against the API that is in `main`. If the API changes a shape the screens use,
the `web` job fails on the pull request that changed it — which is the point.
