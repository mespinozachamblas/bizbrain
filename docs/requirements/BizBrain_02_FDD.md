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
- User can assign one or more topics to a source configuration.
- User can scope a source to one or more research streams.

### Behavior
- Source settings screen stores source configs.
- Config changes are versioned and logged.
- Source test action validates credentials and basic connectivity.
- Source test results are persisted so the dashboard can show the latest health state per source.

## 2A. Topic and Research Stream Management
### Requirements
- User can add, edit, enable, disable, archive, or delete topics without code changes.
- User can define multiple research streams such as `opportunity-research` and `social-media-research`.
- Each research stream can have its own topics, recipients, and delivery rules.
- User can configure copywriting frameworks such as AIDA, PAS, BAB, and other structured persuasive formats for social media outputs.
- User can configure marketer-style profiles inspired by recognized schools of sales and copywriting, such as Russell Brunson funnel-led framing, David Ogilvy clarity-led framing, Eugene Schwartz awareness-led framing, Claude Hopkins proof-led framing, Gary Halbert direct-response framing, Joanna Wiebe conversion-focused framing, April Dunford positioning-led framing, and Seth Godin permission or idea-led framing.

### Behavior
- Topic settings screen stores topic name, keywords, exclusions, and stream assignment.
- Research stream settings screen stores stream metadata, enabled status, and email delivery preferences.
- Sources can contribute to more than one topic and more than one stream where appropriate.
- Social media research settings store enabled channels such as `linkedin` and `x`, plus default copy framework, style profile, and media mode preferences per topic or per stream.
- Social media research settings must also support a media sourcing policy that distinguishes allowed publishable sources from reference-only discovery sources.

## 3. Ingestion Jobs
### Requirements
- Jobs run on a schedule through Railway cron services.
- Jobs must be safe to re-run.
- Jobs must record job status, counts, and errors.

### Behavior
- `daily-ingest` fetches new records only.
- `daily-enrich-score` processes newly ingested items that lack enrichment, updates cluster scoring, and determines idea eligibility.
- `daily-digest-email` compiles and emails the opportunity research summary.
- `daily-social-media-digest-email` compiles and emails the social media research summary.

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
- System must store a first-class idea quality score and quality reason.
- System must store source attribution explaining which sources contributed to an idea.

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
- quality score
- quality reason
- source attribution summary

## 8. Idea Database
### Requirements
- User can search, filter, sort, and annotate ideas.
- User can filter specifically for fintech and finance product concepts.
- User can maintain statuses.
- User can filter ideas by topic and research stream.
- User can see which sources contributed to an idea.
- User can mark ideas as promising, ignore, or revisit for later review.

### Status values
- new
- reviewing
- promising
- revisit
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
- top topics
- research stream status
- social media research email status
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
- Different research streams must generate distinct digests.

### Behavior
- Opportunity digest service selects top items by score, novelty, confidence, quality score, and source diversity.
- Social media digest service selects top items by topic fit, hook quality, audience relevance, and source support.
- Digest generates markdown and HTML versions.
- Digest is saved to the database before sending.
- Resend sends the HTML and plaintext variants to each configured recipient.
- Delivery result is logged.

## 10A. Social Media Research Output
### Requirements
- The system can generate LinkedIn-style research drafts from configured topics.
- The system can generate X-ready post and thread drafts as a social media sub-stream.
- Social media research outputs must remain separate from opportunity ideas and digests.
- Social media outputs must follow a strict schema.
- User can review, accept, reject, or revisit generated content drafts without affecting idea statuses.
- The system can generate a visual brief for each content draft.
- Visual brief can target `none`, `stock`, or `ai-generated` asset modes.
- The system can propose media candidates from approved or reference-only sources, but must label whether each candidate is publishable, attribution-required, or reference-only.
- Approved publishable-source classes may include first-party images, explicitly licensed stock libraries, and open-license media indexes such as Unsplash, Pexels, Pixabay, Openverse, and Wikimedia Commons.
- Google Images, Pinterest, and similar search/discovery surfaces must be treated as reference-only or source-discovery inputs unless the original asset license is independently verified from the origin site.
- The system can generate infographic concepts and outlines for LinkedIn posts.
- Infographic outputs can target carousel, single-image infographic, or short data-story formats.
- The system can generate publishable wow-factor statistics research for social drafts and infographics when relevant to the configured topic or stream.
- The system must distinguish between publishable external insight statistics and non-publishable signal evidence statistics used for internal validation.
- Statistics research must remain evidence-backed and must store the cited source, source URL, claim wording, and any confidence or freshness note used in the draft.
- The system must support configurable copy frameworks and style profiles without code changes.
- Style profiles must be implemented as configurable traits and instructions, not as literal impersonation requirements.
- Suggested stock or AI-generated assets must remain reviewable and optional before use.
- Suggested media must keep provenance metadata including origin URL, source type, license label when known, attribution requirement when known, and review status.
- The system must avoid suggesting direct reuse of logos, trademarks, celebrity/public-figure likenesses, copyrighted editorial photos, or identifiable people without clear rights or review.

### Output fields
- target channel
- topic
- target audience
- hook
- copy framework
- style profile
- thesis
- supporting points
- counterpoint or tension
- CTA
- draft LinkedIn post
- draft X post
- draft X thread outline
- visual brief
- supporting statistics
  Publishable wow-factor statistics should come from externally sourced reports, news, surveys, studies, benchmarks, or datasets.
  Platform metrics, source counts, cluster counts, and marketplace/search attention data should be stored separately as signal evidence unless explicitly revalidated for public use.
- statistic citations
- statistic freshness or confidence note
- media candidates
- media provenance
- publishability status
- asset mode recommendation
- infographic brief
- infographic format
- infographic panel outline
- source attribution

## 11. Email Delivery and Retry
### Requirements
- Failed sends must be logged.
- Email sends must be idempotent by digest date plus research stream plus recipient.
- Optional retry policy should avoid duplicate spam.

### Behavior
- System generates a digest record keyed by date and research stream such as `digest:YYYY-MM-DD:opportunity-research`.
- System generates a send key such as `digest:YYYY-MM-DD:social-media-research:recipient@example.com`.
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
