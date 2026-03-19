# Architecture Boundaries

- Keep UI concerns in `apps/web`.
- Keep scheduled runtime logic in `apps/worker`.
- Keep shared business logic in `packages/core`.
- Keep database schema and DB access in `packages/db`.
- Keep email rendering in `packages/email`.
- Keep prompt text and output contracts in `packages/prompts`.
- Do not bypass shared packages with duplicated logic across apps.
