# AGENTS.md

## Project overview
This repository powers the BizBrain. It discovers trends and idea opportunities from public signals, stores them in Postgres, and sends a daily digest via Resend. Production scheduling runs on Railway cron services.

## Core architecture
- Next.js web app for dashboard and admin actions
- Railway Postgres for operational data
- Railway cron services for daily jobs
- Resend for email delivery
- structured LLM outputs validated before persistence

## Non-negotiable rules
1. Preserve idempotency in all cron jobs.
2. Do not make destructive schema changes without a report-first review.
3. Do not change email delivery behavior without updating tests and delivery logging.
4. Do not replace structured JSON outputs with free-form text where parsers depend on schema.
5. Keep production-safe defaults for recipients in non-production.
6. Close DB connections and exit cleanly in cron handlers.

## Required workflows
- Use the verification workflow when runtime, tests, schema, prompts, or email templates change.
- Use a report-first workflow for migrations, scoring redesigns, digest selection changes, and source adapter rewrites.
- Prefer the smallest possible change that solves the problem.

## Commands to know
Document and maintain the exact commands for:
- install
- dev
- lint
- typecheck
- test
- db migrate
- db seed
- run specific cron tasks locally

## Editing guidance
- Keep changes targeted.
- Update docs when architecture, workflows, or env vars change.
- Preserve backward compatibility unless a deliberate migration plan exists.
- Explain reasoning when changing prompts, scores, or category taxonomies.

## Testing expectations
Run or recommend:
- lint
- typecheck
- relevant unit tests
- relevant integration tests
- email render tests when digest templates change

## Security and data safety
- Never hardcode secrets.
- Never commit real owner email addresses or production API keys.
- Treat source configs, prompts, and scoring rules as versioned assets.
