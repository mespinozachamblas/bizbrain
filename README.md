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
4. Apply committed migrations with `pnpm db:migrate` once `DATABASE_URL` points at Postgres.
5. Seed starter records with `pnpm db:seed`.
6. Start the web app with `pnpm dev:web`.
7. Run worker jobs locally with `pnpm worker:daily-ingest`, `pnpm worker:daily-enrich-score`, or `pnpm worker:daily-digest-email`.

## Source Modes
- Default development mode is deterministic `sample`.
- Set `SOURCE_DEFAULT_MODE=live` to let supported adapters fetch real data.
- For live Reddit fetching, set `SOURCE_HTTP_USER_AGENT` to a real descriptive user agent before running source tests or ingest.
- Google Trends live mode uses the public RSS feed, applies keyword filtering from the source config, and does not require an API key.
- Hacker News live mode uses the public Firebase API and filters story content with word-boundary keyword matching.
- Product Hunt live mode uses the official GraphQL API and requires `PRODUCT_HUNT_ACCESS_TOKEN`; the starter config falls back to `sample` mode until that token is set.

## Database Commands
- `pnpm db:generate`: regenerate Prisma client
- `pnpm db:migrate`: apply committed migrations to the target Postgres database
- `pnpm db:migrate:dev`: create/apply development migrations against a live Postgres database
- `pnpm db:status`: inspect migration state
- `pnpm db:seed`: ensure starter source config and digest recipients

## Current State
This is an initial scaffold. It creates the package boundaries, placeholder entrypoints, and repo policy files so implementation can proceed against a stable layout.
