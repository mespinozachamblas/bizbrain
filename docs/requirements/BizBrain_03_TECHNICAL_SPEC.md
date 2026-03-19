# Technical Specification

## 1. Recommended Stack
### Runtime
- Railway persistent service for the web/API app
- Railway cron services for scheduled jobs
- Railway Postgres as the primary operational database
- GitHub for source control and CI

### Application
- Next.js with TypeScript
- Node.js runtime
- Prisma or Drizzle ORM
- Zod for schema validation
- React Email or equivalent email templating
- Resend for outbound daily digests

### Agent layer
- Cursor for interactive development
- Codex for local CLI or CI-driven automation
- Repo-local `AGENTS.md`
- Repo-local `.cursor/rules/`
- Repo-local `.agents/skills/`
- Optional global skills installed from the broader skills ecosystem

## 2. Deployment Topology
### Service 1: web
Purpose:
- dashboard
- authentication
- manual admin actions
- idea browsing
- job run inspection

### Service 2: cron-daily-ingest
Purpose:
- fetch and persist new source items
- exit cleanly after completion

### Service 3: cron-daily-enrich-score
Purpose:
- enrich signals
- update clusters
- recalculate scores
- create new ideas

### Service 4: cron-daily-digest-email
Purpose:
- build digest
- render email
- send via Resend
- record send status

### Optional Service 5: cron-weekly-maintenance
Purpose:
- stale cluster cleanup
- re-clustering candidates
- archive old rejected items
- produce weekly review report

## 3. Why Postgres is Preferred Here
This edition recommends Postgres instead of Firestore as the primary store because:
- trend clustering and filtering fit relational querying well
- jobs, digests, idea statuses, and audit tables are easier to analyze
- future analytics and SQL reporting will be useful
- Railway-managed Postgres keeps runtime and storage in one place

A Firestore adapter may still be added later if you want shared patterns with other apps.

## 4. Core Domains
### Source ingestion
- source config
- raw signals
- enrichment results
- cluster membership

### Opportunity intelligence
- clusters
- opportunity scores
- ideas
- validation notes

### Operations
- job runs
- source config versions
- source health checks
- source runs
- run artifacts
- digest records
- email delivery records
- retry records

## 5. Scheduled Job Design
### Principles
- every job is idempotent
- every job can run independently
- every job writes a run log
- jobs use a lock or concurrency guard
- long-running work is chunked and checkpointed

### Example job schedule in the owner-configured local timezone
- `daily-ingest`: `05 06 * * *`
- `daily-enrich-score`: `20 06 * * *`
- `daily-digest-email`: `35 06 * * *`
- `weekly-maintenance`: `00 08 * * 0`

The cron schedule should be defined and displayed in the owner-configured local timezone. The system must not intentionally drift relative to local clock time during daylight saving transitions.

## 6. Concurrency and Idempotency
Each cron job must:
- create a job-run record at start
- acquire a lock scoped to the job name and logical date
- skip or abort cleanly if a valid lock already exists
- use upsert behavior where appropriate
- close DB connections and exit on completion

## 7. Suggested Monorepo Layout
- `apps/web`
- `apps/worker`
- `packages/db`
- `packages/core`
- `packages/email`
- `packages/prompts`
- `packages/agents`
- `.cursor/rules`
- `.agents/skills`
- `docs`

## 8. Email Delivery Design
### Recommended flow
1. Compile digest candidates.
2. Persist digest record.
3. Render markdown and HTML.
4. Send with Resend.
5. Store provider response and status.
6. Mark digest as sent.
7. Retry only on explicit failure states.

### Required env vars
- `DATABASE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OWNER_EMAIL`
- `DIGEST_RECIPIENTS`
- `APP_BASE_URL`
- `CRON_SHARED_SECRET`
- `OPENAI_API_KEY`
- `OWNER_TIMEZONE`
- `SOURCE_*`

## 9. AI Output Contracts
All model output used by the pipeline must be schema-validated.

### Structured outputs
- cluster summary JSON
- opportunity scoring explanation JSON
- idea generation JSON
- digest section JSON

The pipeline should never rely on free-form LLM prose alone for downstream writes.

## 10. Error Handling
- invalid model output is quarantined, not silently accepted
- failed source pulls do not cancel unrelated sources
- source test failures and runtime failures are stored per source for later triage
- digest generation can degrade gracefully if one source fails
- send-email failure does not erase digest content

## 11. Observability
### Minimum requirements
- Railway logs enabled
- application logs with request or run IDs
- job-run dashboard in app
- email-send status history
- alert when a scheduled job misses its expected completion window

## 12. Security
- secrets stored in Railway variables
- admin-only manual job triggers
- source credentials rotated as needed
- outbound email recipient defaults restricted in non-production
- multi-recipient delivery must support safe non-production overrides
- prompts and templates treated as versioned assets
- migrations require review-first workflow

## 13. Testing
- unit tests for scoring, normalization, and digest selection
- integration tests for cron handlers
- contract tests for LLM JSON parsing
- email rendering snapshot tests
- migration smoke tests
- replay test fixtures for selected source inputs
