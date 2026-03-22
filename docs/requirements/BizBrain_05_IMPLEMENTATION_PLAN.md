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
- add research stream management
- add topic management
- add copy framework and style profile management
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
- add first-class idea quality scoring and source attribution
- build idea detail pages
- add statuses, notes, tags, and revisit/ignore feedback controls

## Phase 5 — Daily Digest and Resend
- build digest selection rules
- build markdown and HTML templates
- implement Resend sending service
- implement multi-recipient fanout with per-recipient idempotency
- persist delivery records
- deploy `cron-daily-digest-email`

## Phase 6 — Social Media Research Stream
- add social media research stream schema and settings
- create social-media-specific prompts and strict JSON schema
- implement LinkedIn-style draft generation
- implement X post and thread draft generation
- add content draft review states and approval workflow
- add configurable copy frameworks such as AIDA, PAS, BAB, and educational authority-led structures
- add configurable marketer-style profiles and trait bundles
- add visual brief generation for stock and AI-generated asset modes
- add stream-aware external insight statistics research and citation capture for social drafts and infographic concepts
- keep signal evidence statistics in a separate review path so internal proof does not masquerade as publishable wow-factor content
- add infographic brief and panel-outline generation for LinkedIn educational posts
- add media candidate provenance schema and review workflow
- add media-source policy with approved, review-required, and reference-only source classes
- add legal-safety checks for trademarks, likenesses, attribution, and unverified discovery-source reuse
- build separate markdown and HTML templates
- implement stream-specific recipients and subject lines
- deploy `cron-daily-social-media-digest-email`

## Phase 7 — Agent Hardening
- refine rules after first real development cycles
- add verification skill
- add migration safety skill
- add digest review skill
- add prompt regression checklist
- add CI hooks for tests and linting

## Phase 8 — Maintenance and Quality
- weekly cleanup job
- source health checks
- retry tooling for failed digests
- analytics around which ideas are opened, promoted, or rejected
- periodic audit of media candidates lacking provenance or review decisions

## Suggested Order of Work in Cursor/Codex
1. repo setup and rules
2. schema and migrations
3. ingestion job
4. enrichment and clustering
5. scoring engine
6. idea generation
7. topic and stream management
8. opportunity digest generation
9. social media research generation
10. media provenance and legal-safety workflow
11. email delivery
12. tests and fixtures
13. maintenance workflows

## Definition of Done for MVP
- daily jobs run end to end on Railway
- top results are visible in app
- daily digest email sends successfully through Resend to each configured recipient
- social media research digest sends successfully through Resend to each configured recipient
- social drafts can include reviewable external insight statistics with source URLs and confidence/freshness notes
- social drafts can also include separate signal-evidence statistics for internal review, trend validation, and operator-facing context
- social media media candidates are clearly labeled publishable, review-required, or reference-only with provenance retained
- job-run logs explain what happened each day
- source health and source-level failures are visible in the app
- topics and research streams can be configured without code changes
- reviewers can mark ideas and content drafts with lightweight feedback states
- rules and skills are present and used in normal development
- repo can be safely handed to Cursor/Codex with limited drift
