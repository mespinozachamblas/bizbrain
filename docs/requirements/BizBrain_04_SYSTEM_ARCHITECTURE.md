# System Architecture

## 1. Architecture Summary
This version uses a **Railway-first operational architecture** with:
- one always-on web/API service
- multiple scheduled cron services
- one primary Postgres database
- Resend for outbound daily email
- Cursor/Codex as development and maintenance agents, not as the core runtime

## 2. Architectural Principle
Deterministic pipeline steps should own production data movement. Agents should assist with:
- code generation
- maintenance
- test creation
- digest refinement
- documentation
- report-first workflows

Agents should not be the sole mechanism that keeps daily production jobs alive.

## 3. Logical Layers
### Presentation layer
- Next.js app
- dashboard
- idea detail pages
- source settings
- job history
- digest archive

### Application layer
- API routes or server actions
- auth checks
- query and mutation handlers
- admin job triggers

### Processing layer
- Railway cron services
- ingestion pipeline
- enrichment pipeline
- clustering pipeline
- scoring pipeline
- digest pipeline
- email pipeline

### Data layer
- Postgres
- migrations
- durable run logs
- digest and email records

### Integration layer
- public data source adapters
- OpenAI for structured generation tasks
- Resend for email delivery
- GitHub for repo automation

## 4. Sequence Flow
1. `cron-daily-ingest` starts and writes a run record.
2. New source items are normalized and persisted.
3. `cron-daily-enrich-score` enriches signals, updates clusters, recalculates scores, and creates new ideas.
4. `cron-daily-digest-email` selects the best items for the current date.
5. Digest content is saved, rendered, and sent through Resend.
6. Web app surfaces the latest ideas, runs, and digest records.
7. Weekly maintenance reprocesses edge cases and keeps the dataset clean.

## 5. Agent-Aware Repo Architecture
The repository should expose three layers of agent guidance:
- `AGENTS.md` for always-on repository policy
- `.cursor/rules/` for project-specific development and editing constraints
- `.agents/skills/` for repeatable workflows with optional scripts and references

Optional global rules and skills should remain lean and generic so they do not fight with project-local behavior.

## 6. Failure Domains
### Cron service failure
Impact:
- current stage delayed
Mitigation:
- isolate stages into separate cron services
- log and retry only the failed stage

### Email delivery failure
Impact:
- user misses digest
Mitigation:
- persist digest before send
- retry sends without rerunning discovery
- log provider response

### Model output failure
Impact:
- invalid structured output
Mitigation:
- validate against schema
- quarantine bad output
- fallback to deterministic summary when possible

### Agent drift
Impact:
- risky code changes or prompt bloat
Mitigation:
- strong rules
- report-first skills
- mandatory verification skill before merge
- AGENTS.md triggers

## 7. Scaling Path
### MVP
- one owner
- one database
- low source count
- daily digest

### Growth
- more sources
- pgvector or dedicated vector search
- team workspaces
- more granular alerting
- weekly and monthly reports
- multi-recipient email delivery

### Future SaaS
- tenant-aware schemas or row-level separation
- per-workspace source configs
- usage quotas
- billing
- user-level digest preferences
