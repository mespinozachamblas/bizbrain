# Product Requirements Document (PRD)
## Product Name
BizBrain — Automated Workflow Edition

## Brand Naming Convention
- **Primary internal and product name:** BizBrain
- **Allowed stylistic display variant:** Biz-Brain
- Default to **BizBrain** in technical docs, repo names, service names, database identifiers, environment labels, and agent/rules files.
- Reserve **Biz-Brain** for optional marketing copy, logos, and UI display experiments.

## Product Vision
Build a founder-focused application that continuously discovers trends, recurring pain points, product gaps, and business opportunities from public signal sources, stores them in a structured idea database, and delivers prioritized daily summaries by email. The system should support agent-assisted execution in Cursor and Codex while remaining reliable enough to run unattended on Railway scheduled jobs.

## Product Goals
The product must:
- automatically ingest and normalize public signals on a schedule
- cluster repeated problems and rising themes
- score opportunities across SaaS, fintech, finance products, property management, SMB automation, and wellness use cases
- generate structured idea records and research summaries
- maintain a searchable idea database
- email a digest of the best results every day to one or more configured recipients
- expose enough context and guardrails for Cursor/Codex agents to contribute safely

## Primary User
A solo founder / operator who:
- wants to discover ideas quickly
- prefers automation over manual browsing
- uses Cursor/Codex to build and maintain the system
- wants daily insight emails without opening the app
- may expand the product into a future multi-user SaaS

## Problem Statement
Manual opportunity research is fragmented across Reddit, search trends, review pages, niche communities, product forums, and bookmarked notes. Good ideas are lost, duplicated, or not compared consistently. Generic automation pipelines create noise, while fully autonomous agents can drift without strong repo rules and workflow controls.

The app should solve this by combining:
- deterministic ingestion and scoring jobs
- structured data storage
- transparent opportunity scoring
- agent-guided but bounded content generation
- daily email delivery of high-value output

## Success Metrics
The MVP is successful if it:
- ingests and processes data daily without manual intervention
- produces a usable shortlist of opportunities each day
- sends a digest email successfully to each configured recipient each scheduled day
- keeps duplicate ideas below an acceptable threshold
- lets the user search and filter ideas effectively
- allows Cursor/Codex to accelerate work without breaking architecture or schema integrity

## In Scope
### Trend and idea discovery
- source ingestion
- text normalization
- pain-point extraction
- clustering
- scoring
- structured idea generation

### Domains
- B2B SaaS
- fintech ideas
- finance products
- property management / landlord services
- SMB automation
- wellness / content commerce

### Delivery and review
- web dashboard
- daily email digest
- manual idea review workflow
- notes, tags, status transitions

### Automation
- Railway cron jobs
- agent-aware repo documentation
- project rules
- repo-local skills
- optional global rules and skills

## Out of Scope for MVP
- consumer-facing public SaaS launch
- billing and subscriptions
- guaranteed market validation
- automated investing or underwriting decisions
- direct execution of financial transactions
- scraping private or gated sources
- complex team permissions

## User Stories
- As a user, I want the system to ingest signals each day so I do not need to hunt manually.
- As a user, I want repeated problems clustered together so I can see patterns rather than isolated posts.
- As a user, I want opportunities scored across multiple categories including fintech and finance products.
- As a user, I want strong ideas emailed to me every day so I can review them quickly.
- As a user, I want evidence linked to each idea so I can verify why it surfaced.
- As a developer, I want clear project rules and skills so Cursor/Codex can work on the repo safely.
- As a developer, I want scheduled jobs separated by responsibility so failures are isolated and easy to debug.

## Functional Scope
### Core modules
1. Source configuration
2. Signal ingestion
3. Signal enrichment
4. Trend clustering
5. Opportunity scoring
6. Idea generation
7. Idea database
8. Daily digest generation
9. Email delivery
10. Job health and audit logging
11. Agent control layer via docs, skills, and rules

## Opportunity Taxonomy
Each idea should be categorized into one or more of:
- SaaS
- service business
- marketplace
- media/content opportunity
- fintech workflow tool
- finance product concept
- landlord / real estate workflow tool
- operational automation tool

### Fintech / finance product examples the system should support
- mortgage-rate alert tools
- debt optimization planners
- landlord cash-flow and reserve tools
- loan comparison tools
- payment reconciliation or collections workflow tools
- finance reporting helpers for SMBs
- treasury / liquidity dashboards for small operators
- rate-sensitivity monitoring tools

## Daily Digest Requirements
The system must email one or more configured recipients a daily summary with:
- scheduling based on the owner-configured local timezone
- top new opportunities
- major cluster movers
- strongest fintech / finance ideas
- notable evidence links
- confidence notes
- failed or skipped sources, if any
- next recommended actions

## Product Risks
- noisy sources can create junk clusters
- duplicate clusters can lower trust
- LLM output can overstate certainty
- cron runs can overlap or be skipped if not designed carefully
- agents can over-edit architecture without strict repo controls
- email digests can become verbose or repetitive

## Product Principles
- evidence before opinion
- deterministic pipeline first, agent assistance second
- idempotent jobs
- small scheduled steps instead of one giant run
- explainable scores
- human review for high-impact changes
- repo-local rules before clever prompts
