# Resend Email Requirements

## 1. Purpose
The system must send a daily email digest of the best trend and idea findings to one or more configured recipients using Resend.

## 2. Why Resend Fits This App
Resend is already part of your stack, reduces setup friction, and fits a developer-centric workflow. The app should treat email delivery as a first-class subsystem, not a side effect of the digest job.

## 3. Functional Requirements
- send one daily digest email to each enabled configured recipient
- support multi-recipient delivery in MVP
- store both markdown and HTML renderings
- store provider response identifiers
- log failures with reason text
- support resend of a specific digest date from admin UI

## 4. Content Requirements
Each digest must include:
- date and generation timestamp
- top new opportunities
- fastest-rising clusters
- top fintech ideas
- top finance product concepts
- evidence snippets or links
- confidence or caution notes
- pipeline health notes if a source or job failed

## 5. Delivery Requirements
- use `RESEND_API_KEY`
- use a verified sender stored in `EMAIL_FROM`
- send to `OWNER_EMAIL` plus any enabled configured recipients in production
- include plaintext fallback
- persist `provider_message_id`
- mark digest send outcome

## 6. Reliability Requirements
- digest must be saved before send
- send must be idempotent by digest date plus recipient
- failed sends can be retried without re-running ingestion
- retries must not create multiple successful sends for the same digest/recipient unless forced
- the send schedule must follow the owner-configured local timezone

## 7. Template Requirements
- mobile-friendly HTML
- lightweight branding
- readable on dark and light themes
- short subject line
- section headers
- compact bullet summaries
- direct link back to the app for full review

## 8. Optional Future Enhancements
- Resend webhook ingestion for delivery and bounce events
- weekly summary
- category-specific digest preferences
- attachment export
- digest A/B subject testing
- internal QA inbox in non-production

## 9. Recommended Subject Pattern
`Opportunity Digest — YYYY-MM-DD`

## 10. Env Vars
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OWNER_EMAIL`
- `DIGEST_RECIPIENTS`
- `DIGEST_REPLY_TO`
- `APP_BASE_URL`

## 11. Test Requirements
- render snapshot tests
- schema tests for digest selection payload
- mocked email provider tests
- one staging smoke send before production enablement
