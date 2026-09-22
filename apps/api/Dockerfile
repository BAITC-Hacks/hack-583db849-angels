FROM node:22-alpine

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @invision/api...
COPY apps/api apps/api
RUN pnpm --filter @invision/api exec prisma generate
RUN pnpm --filter @invision/api build

EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3001/v1/health || exit 1
CMD ["sh", "-c", "pnpm --filter @invision/api exec prisma migrate deploy && exec pnpm --filter @invision/api start"]
