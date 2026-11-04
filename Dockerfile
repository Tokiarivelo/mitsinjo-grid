# Mitsinjo Grid web app (Next.js 15 + engine). Keyless by default: LLM_PROVIDER=mock.
# Run it with Docker Compose (compose.yaml): make docker-up → http://localhost:3000
FROM node:22-bookworm-slim AS deps
ENV SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY apps/bridge/package.json apps/bridge/
COPY tests/package.json tests/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps apps
COPY packages packages
RUN pnpm --filter web build

FROM build AS run
ENV NODE_ENV=production \
    PORT=3000 \
    LLM_PROVIDER=mock
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
