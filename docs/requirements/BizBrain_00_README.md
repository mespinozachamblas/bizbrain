# BizBrain — Automated Workflow Edition

This package regenerates the requirements set around a **Railway-first runtime**, **agent-assisted workflows for Cursor/Codex**, **configurable research topics and streams**, **daily email digests via Resend**, and **repo-local plus global skills/rules** for tighter development control.

## Naming
- **Primary product name:** BizBrain
- **Optional display style:** Biz-Brain
- Use **BizBrain** in code, docs, repo names, environment labels, and internal references unless a specific UI or marketing context benefits from the stylized **Biz-Brain** form.


## What changed in this edition
- Runtime architecture now assumes **Railway** for the web/API service and scheduled jobs.
- Data model now prefers **Postgres on Railway** as the primary operational database.
- Daily results delivery is now a first-class requirement through **Resend**.
- Agent workflows are documented as a real subsystem rather than an afterthought.
- The package now includes:
  - updated product and technical requirements
  - automation and agent requirements
  - Resend email requirements
  - dual-stream research requirements for opportunity research and social media research
  - repo-local project rules for Cursor
  - repo-local skills for Codex/Cursor-style agents
  - templates for global rules and global skills

## Recommended repo placement
- Copy `AGENTS.md` to the project root.
- Copy `.cursor/rules/*` into your project repository.
- Copy `.agents/skills/*` into your project repository.
- Review `global-templates/` and selectively move those into your own global agent setup.
- Keep `docs/` or these root markdown files inside the repo for agent context and human reference.

## File list
1. `01_PRD.md`
2. `02_FDD.md`
3. `03_TECHNICAL_SPEC.md`
4. `04_SYSTEM_ARCHITECTURE.md`
5. `05_IMPLEMENTATION_PLAN.md`
6. `06_DATA_MODEL_AND_API_CONTRACTS.md`
7. `07_AUTOMATION_AND_AGENT_REQUIREMENTS.md`
8. `08_RESEND_EMAIL_REQUIREMENTS.md`
9. `09_SKILLS_AND_RULES_STRATEGY.md`
10. `AGENTS.md`
11. `.cursor/rules/*`
12. `.agents/skills/*`
13. `global-templates/*`

## Recommended starting point
Start with:
1. `01_PRD.md`
2. `03_TECHNICAL_SPEC.md`
3. `07_AUTOMATION_AND_AGENT_REQUIREMENTS.md`
4. `09_SKILLS_AND_RULES_STRATEGY.md`
5. `05_IMPLEMENTATION_PLAN.md`
