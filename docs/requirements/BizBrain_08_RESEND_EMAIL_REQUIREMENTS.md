# Resend Email Requirements

## 1. Purpose
The system must send daily email digests for each enabled research stream to one or more configured recipients using Resend. MVP streams include opportunity research and social media research.

## 2. Why Resend Fits This App
Resend is already part of your stack, reduces setup friction, and fits a developer-centric workflow. The app should treat email delivery as a first-class subsystem, not a side effect of the digest job.

## 3. Functional Requirements
- send one daily digest email per enabled research stream to each enabled configured recipient
- support multi-recipient delivery in MVP
- store both markdown and HTML renderings
- store provider response identifiers
- log failures with reason text
- support resend of a specific digest date from admin UI
- support stream-specific recipients, subject patterns, and resend behavior

## 4. Content Requirements
Each opportunity research digest must include:
- date and generation timestamp
- top new opportunities
- fastest-rising clusters
- top fintech ideas
- top finance product concepts
- evidence snippets or links
- confidence or caution notes
- pipeline health notes if a source or job failed

Each social media research digest must include:
- date and generation timestamp
- top topics worth posting about
- LinkedIn-ready and X-ready hooks or post angles
- recommended copy framework and style profile
- supporting evidence snippets or links
- optional wow-factor statistics with source links and confidence or freshness notes
- target audience context
- optional visual brief summary for stock or AI-generated assets
- optional media candidate summary with publishability labels and provenance notes
- optional infographic brief summary for carousel or infographic-style LinkedIn posts
- caution notes if a source or job failed
- one or more structured draft post outputs

## 5. Delivery Requirements
- use `RESEND_API_KEY`
- use a verified sender stored in `EMAIL_FROM`
- send to `OWNER_EMAIL` plus any enabled configured recipients in production for the opportunity stream
- support a separate recipient set for the social media research stream
- include plaintext fallback
- persist `provider_message_id`
- mark digest send outcome

## 6. Reliability Requirements
- digest must be saved before send
- send must be idempotent by digest date plus research stream plus recipient
- failed sends can be retried without re-running ingestion
- retries must not create multiple successful sends for the same digest/stream/recipient unless forced
- the send schedule must follow the owner-configured local timezone
- one stream failing to render or send must not block the other stream

## 7. Template Requirements
- mobile-friendly HTML
- lightweight branding
- readable on dark and light themes
- short subject line
- section headers
- compact bullet summaries
- direct link back to the app for full review
- clear indication of which research stream produced the email
- stream-specific framing so social media research is not confused with business opportunity research
- do not imply a media candidate is safe to publish unless the candidate has a documented publishable or reviewed status

## 8. Optional Future Enhancements
- Resend webhook ingestion for delivery and bounce events
- weekly summary
- category-specific digest preferences
- attachment export
- digest A/B subject testing
- internal QA inbox in non-production
- stream-specific delivery schedules

## 9. Recommended Subject Pattern
`BizBrain Opportunity Digest — YYYY-MM-DD`

`BizBrain Social Media Research — YYYY-MM-DD`

## 10. Env Vars
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OWNER_EMAIL`
- `DIGEST_RECIPIENTS`
- `SOCIAL_DIGEST_RECIPIENTS`
- `DIGEST_REPLY_TO`
- `APP_BASE_URL`

## 11. Test Requirements
- render snapshot tests
- schema tests for digest selection payload
- mocked email provider tests
- one staging smoke send before production enablement
- separate snapshot and smoke coverage for each enabled research stream
