# Product Requirements Document (PRD)
## Product Name
BizBrain — Automated Workflow Edition

## Brand Naming Convention
- **Primary internal and product name:** BizBrain
- **Allowed stylistic display variant:** Biz-Brain
- Default to **BizBrain** in technical docs, repo names, service names, database identifiers, environment labels, and agent/rules files.
- Reserve **Biz-Brain** for optional marketing copy, logos, and UI display experiments.

## Product Vision
Build a founder-focused application that continuously discovers trends, recurring pain points, product gaps, and business opportunities from public signal sources, stores them in a structured idea database, and delivers prioritized daily summaries by email. The system should also support separate configurable research streams, including a social media research stream for LinkedIn and X topic and post ideation. The system should support agent-assisted execution in Cursor and Codex while remaining reliable enough to run unattended on Railway scheduled jobs.

## Product Goals
The product must:
- automatically ingest and normalize public signals on a schedule
- cluster repeated problems and rising themes
- score opportunities across SaaS, fintech, finance products, property management, SMB automation, and wellness use cases
- generate structured idea records and research summaries
- support configurable topics that can be added, removed, enabled, or disabled without code changes
- support separate research streams such as opportunity research and social media research
- support configurable copywriting frameworks and marketer-style profiles for social media research
- maintain a searchable idea database
- email a digest of the best results every day to one or more configured recipients per research stream
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
- configurable topic targeting
- daily email delivery of high-value output per research stream

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
- daily email digest for opportunity research
- separate daily email digest for social media research
- manual idea review workflow
- notes, tags, status transitions
- reviewable media candidate workflow for social posts and infographics

### Topic and stream configuration
- configurable topics with keywords, exclusions, and source preferences
- configurable research streams such as `opportunity-research` and `social-media-research`
- stream-specific recipients and delivery preferences
- configurable copy frameworks such as AIDA, PAS, BAB, and educational authority-led structures
- configurable marketer-style profiles inspired by established schools of direct response and category marketing such as Russell Brunson, David Ogilvy, Eugene Schwartz, Claude Hopkins, Gary Halbert, Joanna Wiebe, April Dunford, and Seth Godin
- media source classes that can distinguish preferred publishable libraries such as Unsplash, Pexels, Pixabay, Openverse, Wikimedia Commons, and first-party images from reference-only discovery surfaces such as Google Images and Pinterest

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
- automated social post publishing
- guaranteed rights-cleared media licensing beyond configured stock providers
- direct publication of assets discovered only through Google Images, Pinterest, or similar search/discovery surfaces without independent license verification

## User Stories
- As a user, I want the system to ingest signals each day so I do not need to hunt manually.
- As a user, I want repeated problems clustered together so I can see patterns rather than isolated posts.
- As a user, I want opportunities scored across multiple categories including fintech and finance products.
- As a user, I want strong ideas emailed to me every day so I can review them quickly.
- As a user, I want to configure topics without changing code so the app can follow the themes I care about.
- As a user, I want a separate social media research digest so LinkedIn post ideas do not mix with business opportunity research.
- As a user, I want the system to draft LinkedIn-ready research angles for selected topics without changing the opportunity research workflow.
- As a user, I want the system to draft X-ready angles and thread concepts for selected topics within the same social media research stream.
- As a user, I want lightweight feedback controls such as promising, ignore, and revisit so I can train my own review flow.
- As a user, I want to choose a copywriting framework such as AIDA or PAS for social media drafts.
- As a user, I want to choose a marketer-style profile so content can lean more direct-response, educational, contrarian, or category-creation oriented.
- As a user, I want optional stock-image or AI-image guidance for social posts without forcing media generation every time.
- As a user, I want optional infographic concepts and outlines for LinkedIn so the system can turn research into visual educational content.
- As a user, I want the system to distinguish between reference-only imagery and publishable assets so I do not accidentally reuse content without rights.
- As a user, I want media candidates to keep license, provenance, and attribution notes so I can review legal risk before publishing.
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
8. Topic configuration
9. Research stream management
10. Daily digest generation
11. Email delivery
12. Social media research draft generation
13. Job health and audit logging
14. Agent control layer via docs, skills, and rules

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
The system must email one or more configured recipients a daily summary with stream-specific content.

### Opportunity research digest
- scheduling based on the owner-configured local timezone
- top new opportunities
- major cluster movers
- strongest fintech / finance ideas
- notable evidence links
- confidence notes
- failed or skipped sources, if any
- next recommended actions

### Social media research digest
- scheduling based on the owner-configured local timezone
- top topic-worthy themes
- strong hooks and contrarian angles
- recommended copy framework and style profile
- supporting evidence snippets
- draft LinkedIn post directions or outlines
- draft X post or thread directions or outlines
- optional visual brief for stock or AI-generated media
- optional infographic brief or outline for LinkedIn carousel or single-image educational posts
- optional media candidate summaries that clearly label `publishable` versus `reference-only`
- provenance notes for any suggested media asset that may require attribution, a release, or a manual rights check
- audience and CTA suggestions
- failed or skipped sources, if any
- next recommended actions

## Product Risks
- noisy sources can create junk clusters
- duplicate clusters can lower trust
- LLM output can overstate certainty
- topic configuration can become too broad and dilute relevance
- overly rigid style profiles can make social media drafts feel synthetic or repetitive
- reference imagery from search/discovery platforms can be mistaken for reusable assets unless provenance and rights checks are explicit
- generated media can create trademark, likeness, or implied-endorsement risk if human review is skipped
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
- treat Google Images, Pinterest, and similar discovery surfaces as inspiration or source-discovery tools, not automatic publishable asset libraries
- require provenance, license context, and review state for any media candidate proposed for publication
