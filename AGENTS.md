# AGENTS.md

## Project Overview
This repository powers BizBrain. The monorepo is split into a web app, worker jobs, and shared packages for data, domain logic, email rendering, prompts, and agent workflows.

## Core Architecture
- `apps/web` owns the Next.js dashboard, admin actions, and digest review surface.
- `apps/worker` owns scheduled job entrypoints and local cron runners.
- `packages/db` owns schema and database access boundaries.
- `packages/core` owns domain types and pipeline logic.
- `packages/email` owns digest rendering helpers.
- `packages/prompts` owns structured prompt assets.
- `packages/agents` owns reusable agent workflow metadata.

## Non-Negotiable Rules
1. Preserve idempotency in cron jobs.
2. Use report-first workflow before destructive schema or delivery changes.
3. Keep structured model outputs schema-validated before persistence.
4. Store digest content before attempting delivery.
5. Keep non-production recipient overrides safe.
6. Prefer small, surgical changes over broad rewrites.

## Commands To Know
- Install: `pnpm install`
- Web dev: `pnpm dev:web`
- Worker dev: `pnpm dev:worker`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Migrate DB: `pnpm db:migrate`
- Seed DB: `pnpm db:seed`
- Run ingest locally: `pnpm worker:daily-ingest`
- Run enrich locally: `pnpm worker:daily-enrich-score`
- Run digest locally: `pnpm worker:daily-digest-email`

## Editing Guidance
- Keep package boundaries intact.
- Update docs when env vars, workflows, or contracts change.
- Do not add prompt-dependent writes where deterministic logic should exist.
- Treat source configs, prompts, and scoring rules as versioned assets.
