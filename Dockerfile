# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY data ./data

RUN pnpm build
RUN pnpm --filter @fog-maze-race/server deploy --legacy --prod /runtime/server

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_PATH=/app/web-dist
ENV MAP_STORE_PATH=/app/data/maps.json

WORKDIR /app

COPY --from=build --chown=node:node /runtime/server ./
COPY --from=build --chown=node:node /workspace/apps/web/dist ./web-dist
COPY --from=build --chown=node:node /workspace/data ./data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/health`).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/app/server.js"]
