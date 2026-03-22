# System Architecture

## 1. Architecture Summary
This version uses a **Railway-first operational architecture** with:
- one always-on web/API service
- multiple scheduled cron services
- one primary Postgres database
- Resend for outbound daily email
- separate research streams for opportunity research and social media research
- configurable copy frameworks, style profiles, visual briefs, and infographic briefs for social media outputs across LinkedIn and X
- media candidate provenance and review states for social visuals and infographics
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
- topic settings
- research stream settings
- copy framework and style profile settings
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
- opportunity digest pipeline
- social media research pipeline
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
- media source and discovery integrations with provenance capture
- GitHub for repo automation

## 4. Sequence Flow
1. `cron-daily-ingest` starts and writes a run record.
2. New source items are normalized and persisted.
3. `cron-daily-enrich-score` enriches signals, updates clusters, recalculates scores, and creates new ideas.
4. `cron-daily-digest-email` selects the best opportunity items for the current date.
5. `cron-daily-social-media-digest-email` selects the best social media research items for the current date.
6. Digest content is saved, rendered, and sent through Resend.
7. Web app surfaces the latest ideas, social research drafts, runs, and digest records.
8. Weekly maintenance reprocesses edge cases and keeps the dataset clean.

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

### Media rights failure
Impact:
- post asset or infographic is not safe to publish
Mitigation:
- keep provenance and license metadata with every candidate
- treat Google Images and Pinterest as reference-only unless origin rights are verified
- require human review before publishable use
- keep generated visuals separate from third-party source assets

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
- more configurable topics and streams
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
