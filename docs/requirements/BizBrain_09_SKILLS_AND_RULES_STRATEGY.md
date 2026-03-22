# Skills and Rules Strategy

## 1. Objective
Give Cursor and Codex enough structure to move quickly without letting the repo drift into unsafe schema changes, brittle cron handlers, or inconsistent prompts.

## 2. Layered Guidance Model
### Layer A — Global rules
Use only for evergreen habits that help across many repos.
Examples:
- concise diffs
- no destructive edits without explanation
- verify tests before claiming completion
- prefer typed interfaces and validated outputs

### Layer B — Global skills
Use for reusable procedures that are not business-specific.
Examples:
- debugging
- test triage
- API documentation
- release checklist
- deployment hygiene

### Layer C — Repo-local always-on policy
Use `AGENTS.md` for:
- project overview
- commands
- architecture boundaries
- mandatory workflows
- safety rules
- verification expectations

### Layer D — Repo-local project rules
Use `.cursor/rules/` for:
- architecture constraints
- cron job expectations
- email delivery rules
- migration handling
- prompting and JSON rules
- topic and research stream boundaries

### Layer E — Repo-local skills
Use `.agents/skills/` for:
- code-change verification
- digest review
- social media digest review
- Railway cron runbook
- trend-cluster triage
- Resend delivery QA
- topic and stream configuration QA

## 3. Design Principles
- keep global context small
- keep business logic in the repo
- use report-first skills for risky work
- use skills for repeatable workflows, not one-off wishes
- keep deterministic mechanics in scripts and apps, not in prose
- let rules steer behavior and let skills package procedures

## 4. How to Use skills.sh
The skills ecosystem is useful as a source of reusable templates and installable capabilities, but this project should remain selective.
Use skills from the public ecosystem when they are:
- generic
- well-maintained
- clearly scoped
- compatible with your agent tooling

Do not move core business logic or architecture-specific rules into a broad shared global skill unless it truly applies across multiple repos.

## 5. Recommended Split for This Project
### Global
- generic coding hygiene
- generic debugging
- generic docs work
- generic deployment checks

### Project-local
- Railway cron job patterns
- idempotent job behavior
- Postgres schema and migration rules
- Resend digest safety
- structured LLM output contracts
- finance / fintech scoring considerations
- topic configuration and research stream routing
- separate opportunity and social-media digest handling
- configurable copy framework and style-profile guardrails
- media provenance, publishability, and legal-safety guardrails for social content

## 6. Review Cadence
Review the rules and skills after:
- first successful production cron cycle
- first migration incident
- first email rendering issue
- any major prompt rewrite
- any repeated agent failure pattern
- any new research stream launch
- any topic taxonomy overhaul

## 7. Anti-Patterns to Avoid
- massive global rules files
- duplicating the same instruction in five places
- storing volatile task lists in always-on rules
- letting agents bypass migrations review
- embedding private credentials or real email addresses in skill files
