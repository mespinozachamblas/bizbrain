# Automation and Agent Requirements

## 1. Goal
The app must run its production pipeline through deterministic scheduled jobs while also exposing a controlled, high-signal environment for Cursor and Codex agents to help build, maintain, test, and review it.

## 2. Separation of Responsibilities
### Scheduled runtime
Owned by:
- Railway web service
- Railway cron services
- Postgres
- Resend
- explicit application code

### Agent assistance
Owned by:
- Cursor in local development
- Codex locally or in CI
- repo-local skills
- project rules
- AGENTS.md

Agents should improve velocity, but not replace core runtime scheduling.

## 3. Scheduled Job Inventory
### daily-ingest
Responsibilities:
- fetch source data
- normalize
- dedupe
- persist raw signals
- map signals to configured topics and research streams

### daily-enrich-score
Responsibilities:
- enrich text
- update clusters
- recompute scores
- generate ideas above threshold
- compute idea quality and source attribution
- generate structured content drafts for enabled non-opportunity streams

### daily-digest-email
Responsibilities:
- select top items
- render opportunity research digest
- send via Resend to all enabled recipients
- persist send result

### daily-social-media-digest-email
Responsibilities:
- select top social media research outputs
- render social media research digest
- send via Resend to all enabled recipients for that stream
- persist send result

### weekly-maintenance
Responsibilities:
- detect stale clusters
- re-run edge-case clustering
- archive low-value records
- produce a maintenance report

## 4. Agent Workflows to Support
### code-change-verification
Run when:
- runtime code changes
- schema changes
- test behavior changes
- email rendering changes

### migration-safety-review
Run when:
- migrations are added or edited
- existing tables are renamed or dropped
- cron behavior changes that depend on schema

### daily-digest-review
Run when:
- email template changes
- digest selection logic changes
- prompt wording changes
- quality filtering changes for opportunity emails

### social-media-digest-review
Run when:
- social media digest template changes
- LinkedIn draft schema changes
- social-media stream selection logic changes
- topic-to-stream routing changes

### source-ingestion-triage
Run when:
- a source adapter breaks
- source payload shape changes
- duplicate volume spikes

### prompt-regression-review
Run when:
- prompts change
- structured schema changes
- output quality drifts

## 5. Mandatory Agent Behaviors
Agents working in this repo must:
- read `AGENTS.md` before major work
- honor `.cursor/rules/`
- prefer minimal, surgical changes
- avoid schema changes without a report-first review
- preserve idempotency in cron handlers
- keep production email safe and non-spammy
- produce strict JSON where downstream parsers expect it
- run or recommend verification commands before handoff
- treat research streams as separate output products with separate recipient and idempotency boundaries
- keep topic configuration editable without requiring code changes

## 6. Report-First Workflows
The following changes should begin with a report, not an edit:
- destructive migrations
- prompt rewrites that affect multiple flows
- scoring weight overhauls
- digest selection logic changes
- changes to email sending behavior
- major source adapter rewrites
- research stream model changes
- topic taxonomy overhauls

## 7. Automation Safety Requirements
- every job run has a lock
- every job exits cleanly
- every email send has a delivery record
- every source test and source failure has a dedicated persisted record
- retries are explicit
- digest content is stored before send
- non-prod environments default to a safe recipient list
- source failures degrade gracefully
- one research stream failing does not block another stream from producing or sending
- each stream has isolated resend and idempotency handling
- topic configuration changes are audit-safe and do not require deploys

## 8. GitHub / CI Support
Codex can be used in CI or GitHub Actions for:
- docs sync
- verification
- PR draft summaries
- release notes
- prompt audits
- digest QA artifacts

Those workflows should operate on repository state and artifacts, not directly mutate production data.

## 9. Skills Strategy
### Repo-local skills
Use for:
- project-specific workflows
- verification
- cron runbooks
- digest review
- migration review
- topic and stream configuration review
- social media digest QA

### Global skills
Use for:
- generic debugging
- generic API documentation
- generic testing help
- generic deployment hygiene

Project-specific business logic should stay local to the repo rather than living in a noisy global setup.

## 10. Acceptance Criteria
- scheduled jobs run daily on Railway
- opportunity digest reaches each enabled recipient via Resend
- social media digest reaches each enabled recipient via Resend when that stream is enabled
- agents have stable repo instructions
- verification workflows are reusable
- risky changes are gated by report-first expectations
- topics and research streams can be reconfigured without code edits
