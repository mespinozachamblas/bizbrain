# BizBrain

BizBrain is a founder-focused opportunity discovery system. This scaffold matches the requirements in [`docs/requirements`](./docs/requirements) and sets up the monorepo layout for the web app, worker jobs, and shared packages.

## Workspace Layout
- `apps/web`: Next.js dashboard and admin surface
- `apps/worker`: scheduled job entrypoints and local cron runners
- `packages/db`: database client, schema, and migrations
- `packages/core`: shared domain types and business logic
- `packages/email`: digest rendering helpers
- `packages/prompts`: structured prompt assets
- `packages/agents`: agent workflow metadata and helpers
- `.cursor/rules`: repo-local Cursor rules
- `.agents/skills`: repo-local agent skills

## First Boot
1. Install workspace dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` or `.env`.
3. Generate the Prisma client with `pnpm db:generate`.
4. Seed starter records with `pnpm db:seed`.
5. Start the web app with `pnpm dev:web`.
6. Run worker jobs locally with `pnpm worker:daily-ingest`, `pnpm worker:daily-enrich-score`, or `pnpm worker:daily-digest-email`.

## Current State
This is an initial scaffold. It creates the package boundaries, placeholder entrypoints, and repo policy files so implementation can proceed against a stable layout.
