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
- build opportunity digest
- render email
- send via Resend
- record send status

### Service 5: cron-daily-social-media-digest-email
Purpose:
- build social media research digest
- render email
- send via Resend
- record send status

### Optional Service 6: cron-weekly-maintenance
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
- research streams
- topics
- copy frameworks
- style profiles
- clusters
- opportunity scores
- ideas
- social media research drafts
- media candidates and provenance
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
- `daily-social-media-digest-email`: `50 06 * * *`
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

The same delivery pattern should be used for both the opportunity digest and the social media research digest, with separate stream identifiers and recipient sets.

### Required env vars
- `DATABASE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OWNER_EMAIL`
- `DIGEST_RECIPIENTS`
- `SOCIAL_DIGEST_RECIPIENTS`
- `APP_BASE_URL`
- `CRON_SHARED_SECRET`
- `OPENAI_API_KEY`
- `OWNER_TIMEZONE`
- `SOURCE_*`

Optional future provider vars:
- stock media provider credentials
- image generation provider credentials
- optional media discovery provider credentials where terms allow it

## 9. AI Output Contracts
All model output used by the pipeline must be schema-validated.

### Structured outputs
- cluster summary JSON
- opportunity scoring explanation JSON
- idea generation JSON
- digest section JSON
- social media research draft JSON
- external insight statistics JSON
- signal evidence statistics JSON
- visual brief JSON
- infographic brief JSON
- copy framework and style profile metadata JSON

Social media draft contracts must support at least `linkedin` and `x` target channels.

The pipeline should never rely on free-form LLM prose alone for downstream writes.

## 9A. Media Sourcing and Rights Guardrails
- The system must distinguish between `publishable`, `review-required`, and `reference-only` media candidates.
- Own images, explicitly licensed stock/open-license libraries, and first-party generated assets are preferred publishable sources.
- Preferred publishable-source classes include first-party assets plus providers such as Unsplash, Pexels, Pixabay, Openverse, and Wikimedia Commons, subject to per-asset review where required.
- Google Images, Pinterest, and similar discovery surfaces must be treated as reference-only or origin-discovery inputs unless the original asset page and license are verified independently.
- The system must store origin URL, source type, license label when known, attribution requirement when known, and reviewer decision for every retained media candidate.
- The system must not auto-publish or auto-attach media candidates that include unverified trademarks, logos, celebrity/public-figure likenesses, or identifiable people without a documented rights basis.
- Visual briefs and infographic briefs may cite reference imagery, but generated output must not assume those references are licensed for direct reuse.

## 10. Error Handling
- invalid model output is quarantined, not silently accepted
- failed source pulls do not cancel unrelated sources
- source test failures and runtime failures are stored per source for later triage
- digest generation can degrade gracefully if one source fails
- send-email failure does not erase digest content
- one research stream failing does not block another stream from completing

## 11. Observability
### Minimum requirements
- Railway logs enabled
- application logs with request or run IDs
- job-run dashboard in app
- email-send status history
- stream-level delivery status history
- alert when a scheduled job misses its expected completion window

## 12. Security
- secrets stored in Railway variables
- admin-only manual job triggers
- source credentials rotated as needed
- outbound email recipient defaults restricted in non-production
- multi-recipient delivery must support safe non-production overrides
- prompts and templates treated as versioned assets
- migrations require review-first workflow
- media publication requires a human review gate before anything discovered through third-party imagery sources is used in a sent or exported asset

## 13. Testing
- unit tests for scoring, normalization, and digest selection
- integration tests for cron handlers
- contract tests for LLM JSON parsing
- email rendering snapshot tests
- migration smoke tests
- replay test fixtures for selected source inputs
