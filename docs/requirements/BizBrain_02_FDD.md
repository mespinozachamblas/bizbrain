# Functional Design Document (FDD)

## 1. Authentication and Access
### Requirements
- The app must require authenticated access.
- The MVP may support a single owner account, but the design should allow a future admin/user split.
- Manual job triggers must be restricted to authorized users.

### Behavior
- User signs in and lands on the dashboard.
- Unauthorized requests to admin or manual-run endpoints are rejected.
- Email recipients are configured by environment variables and admin settings.
- The owner can manage additional digest recipients without changing the digest selection logic.

## 2. Source Management
### Requirements
- User can enable or disable sources.
- User can configure source-specific filters such as subreddit lists, keywords, and exclusions.
- User can set niche mode preferences such as fintech, finance products, or property management.

### Behavior
- Source settings screen stores source configs.
- Config changes are versioned and logged.
- Source test action validates credentials and basic connectivity.
- Source test results are persisted so the dashboard can show the latest health state per source.

## 3. Ingestion Jobs
### Requirements
- Jobs run on a schedule through Railway cron services.
- Jobs must be safe to re-run.
- Jobs must record job status, counts, and errors.

### Behavior
- `daily-ingest` fetches new records only.
- `daily-enrich-score` processes newly ingested items that lack enrichment, updates cluster scoring, and determines idea eligibility.
- `daily-digest-email` compiles and emails the summary.

## 4. Normalization and Enrichment
### Requirements
- System extracts normalized text, keywords, entities, pain points, intent phrases, and category hints.
- System flags finance-related or fintech-related language explicitly.

### Behavior
For each signal:
- clean source text
- strip boilerplate
- detect sentiment and urgency
- extract problem statements
- classify domain tags
- mark potential monetization language
- persist enrichment outputs

## 5. Trend Clustering
### Requirements
- Similar signals must be grouped into a reviewable cluster.
- The app must explain why items belong together.
- Cluster status should support merge, split, and reject workflows later.

### Behavior
- New signals are compared against open clusters.
- If similarity exceeds threshold, the signal joins an existing cluster.
- Otherwise, a new cluster is created.
- Cluster summary is refreshed as evidence changes.

## 6. Opportunity Scoring
### Requirements
- Scores must be component-based rather than opaque.
- Fintech and finance products should have a configurable compliance / trust friction component.
- User should be able to tune weights later.

### Scoring components
- frequency score
- momentum score
- buyer-intent score
- whitespace or visible competition score
- strategic-fit score
- complexity / compliance friction score
- execution feasibility score

### Behavior
The final opportunity score is calculated from weighted components. Finance ideas may score high on pain but still be de-prioritized if trust, data access, or compliance friction is too high.

## 7. Idea Generation
### Requirements
- System generates structured ideas only from evidence-backed clusters.
- The generated output must follow a strict schema.
- The user can edit, reject, or promote any idea.

### Output fields
- title
- category
- subcategory
- target customer
- problem summary
- solution concept
- monetization angle
- go-to-market suggestions
- validation questions
- evidence summary
- risk notes

## 8. Idea Database
### Requirements
- User can search, filter, sort, and annotate ideas.
- User can filter specifically for fintech and finance product concepts.
- User can maintain statuses.

### Status values
- new
- reviewing
- promising
- validating
- rejected
- incubating
- building
- archived

## 9. Dashboard
### Requirements
- The dashboard must surface actionability, not just counts.

### Widgets
- newest signals
- top clusters by score
- fastest movers
- top fintech ideas
- top finance product concepts
- daily email status
- failed source checks
- last successful job runs

## 10. Daily Digest Generation
### Requirements
- A daily digest is created once per day.
- Digest content must be concise enough to scan on mobile.
- Digest must include both summary and traceability.
- Digest generation must be scheduled according to the owner-configured local timezone.
- One digest can be delivered to multiple configured recipients.

### Behavior
- Digest service selects top items by score, novelty, and confidence.
- Digest generates markdown and HTML versions.
- Digest is saved to the database before sending.
- Resend sends the HTML and plaintext variants to each configured recipient.
- Delivery result is logged.

## 11. Email Delivery and Retry
### Requirements
- Failed sends must be logged.
- Email sends must be idempotent by digest date plus recipient.
- Optional retry policy should avoid duplicate spam.

### Behavior
- System generates a digest record keyed by date such as `digest:YYYY-MM-DD`.
- System generates a send key such as `digest:YYYY-MM-DD:recipient@example.com`.
- If a digest has already been sent successfully, retry requires an override.
- Failure states trigger retry eligibility.

## 12. Agent Workflow Support
### Requirements
- The repo must expose enough instructions for agents to contribute safely.
- Agents should be guided toward required verification steps.
- Sensitive operations must require report-first behavior.

### Behavior
- Project rules steer architecture and boundaries.
- Repo-local skills handle repeatable workflows.
- AGENTS.md describes mandatory commands and operating constraints.
- Agents produce plan-first output for risky changes and report-first output for migrations, prompt rewrites, and schema edits.
