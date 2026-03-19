# Implementation Plan

## Phase 0 — Repository Setup
- create repo
- add monorepo structure
- add `AGENTS.md`
- add `.cursor/rules/`
- add `.agents/skills/`
- configure Railway project, environments, and Postgres
- configure Resend domain or sender identity
- set baseline CI

## Phase 1 — Core App Foundation
- scaffold Next.js app
- add auth
- add DB schema and migrations
- add dashboard shell
- add admin settings screens
- add digest recipient management
- add job-run history UI

## Phase 2 — Source and Ingestion Pipeline
- implement source config tables
- implement source config version history
- implement source health check storage
- implement source run logging
- implement source adapters
- implement raw signal storage
- implement dedupe and replay-safe ingestion
- deploy `cron-daily-ingest`

## Phase 3 — Enrichment and Clustering
- add enrichment pipeline
- add category tagging for fintech and finance products
- add cluster creation and update logic
- build cluster review pages
- deploy `cron-daily-enrich-score`

## Phase 4 — Opportunity Scoring and Idea Generation
- implement weighted scoring model
- implement compliance / trust friction scoring for finance ideas
- create idea generation prompts with strict JSON schema
- build idea detail pages
- add statuses, notes, and tags

## Phase 5 — Daily Digest and Resend
- build digest selection rules
- build markdown and HTML templates
- implement Resend sending service
- implement multi-recipient fanout with per-recipient idempotency
- persist delivery records
- deploy `cron-daily-digest-email`

## Phase 6 — Agent Hardening
- refine rules after first real development cycles
- add verification skill
- add migration safety skill
- add digest review skill
- add prompt regression checklist
- add CI hooks for tests and linting

## Phase 7 — Maintenance and Quality
- weekly cleanup job
- source health checks
- retry tooling for failed digests
- analytics around which ideas are opened, promoted, or rejected

## Suggested Order of Work in Cursor/Codex
1. repo setup and rules
2. schema and migrations
3. ingestion job
4. enrichment and clustering
5. scoring engine
6. idea generation
7. digest generation
8. email delivery
9. tests and fixtures
10. maintenance workflows

## Definition of Done for MVP
- daily jobs run end to end on Railway
- top results are visible in app
- daily digest email sends successfully through Resend to each configured recipient
- job-run logs explain what happened each day
- source health and source-level failures are visible in the app
- rules and skills are present and used in normal development
- repo can be safely handed to Cursor/Codex with limited drift
