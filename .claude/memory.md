# Project Memory

Durable, team-visible notes that complement `CLAUDE.md`. `CLAUDE.md` is the architecture reference; this file is a running log of decisions and state that don't belong in the architecture doc itself.

## Deploy

- Backend deploys to Render (`render.yaml`), Docker runtime, `apps/backend/Dockerfile`. Frontend deploy target is separate (see `cors.config.spec.ts` / `FRONTEND_ORIGIN` for the expected origin).
- Single backend instance, no horizontal scaling, no Redis adapter — intentional at pub-quiz scale (see `CLAUDE.md` → Known Tradeoffs).

## CI

- `.github/workflows/ci.yml` runs `pnpm build && pnpm lint && pnpm test` on push to `main` and on every PR.
- The backend's Postgres integration spec (`apps/backend/src/db/entities.integration.spec.ts`) uses `@testcontainers/postgresql` to spin up a real `postgres:16-alpine` container — this works on GitHub-hosted `ubuntu-latest` runners without a separate `services:` block, since Docker is preinstalled there.
- Build must run before lint/test in CI: `@campus-pubquiz/types` resolves via `dist/` (see its `package.json` `main`/`types` fields), so frontend/backend type-checking depends on it being built first. `pnpm -r <script>` runs in workspace-topological order, so `pnpm build` alone handles this.

## Milestones

Three milestones shipped so far — state machine + hardcoded quiz, then a playable quiz with real persistence, then CSV import + media rounds. Full history and evidence files (`.claude/tdd/milestone-*.tdd.md`) are listed in `CLAUDE.md`.
