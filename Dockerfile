FROM node:22-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/agents/package.json packages/agents/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/prompts/package.json packages/prompts/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @bizbrain/db db:generate
RUN pnpm --filter @bizbrain/web build

FROM node:22-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"

RUN corepack enable

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 3000

CMD ["pnpm", "--filter", "@bizbrain/web", "start"]
