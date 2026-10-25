# Mutation testing: the backend services

Status: ready-for-agent

After the first three backend audits, 113 of the backend's 159 mutable files are in neither mutation run: the DB-free slice (`pnpm --filter backend mutate`) holds 28 and `mutate:db` holds the 20 in `game/state/`. Most of the rest is thin Nest plumbing, but services, the socket layer and the read models hold real rules (standings, stats, team merges, answer handling, live edits), and nothing measures how well they're tested.

## Decisions (2026-10-25)

- **Grow `mutate:db`**, no new command. It already runs every spec against Postgres; the new files join its mutate set and its `reports/stryker-db-incremental.json`.
- **Chosen by role, not by a list.** `stryker.files.cjs` picks the files, so a new service lands in the run without anyone editing a list. In: `*.service.ts`, `game/game.gateway.ts`, the logic modules under `game/socket/`, `game/live-edit/` and `game/rest/`, `ended-sessions-read/`, `standings/cell-points.ts`, `auth/password-hash.ts`, `feedback/feedback-off-reason.ts`. Out: controllers, `*.module.ts`, guards, decorators, everything under `db/` (entities, repositories, seed, `question-payload.ts`), `mikro-orm.config.ts`, the `*-http*.ts` error mappers, Zod `*.schema.ts`/`*.schemas.ts` files, `app.service.ts`/`app.controller.ts`. Files already in the DB-free slice stay there.
- **38 files, about 6.5k lines** on 2026-10-25 (`answer`, `auth` ×4, `bonus`, `ended-sessions-read` ×2, `feedback` ×2, `game.gateway`, `live-edit` ×2, `live-session-rest`, `game/socket` ×7, `import`, `joker`, `league` ×2, `log-buffer`, `media`, `player-count`, `quiz` ×2, `showdown`, `standings` ×2, `stats`, `team` ×3).
- **The baseline runs area by area** with `--mutate <files>`, never one multi-hour run. Incremental results carry over, so the areas add up to the full baseline.
- Carried over from `.scratch/mutation-testing-db/spec.md`: one container per run, one database per worker, a flaky spec is a bug with its own ticket, concurrency capped at 8, and nothing else tests or mutates at the same time.

## Tickets

1. Widen `mutate:db` to the services and pilot one area (`issues/01-widen-mutate-db-and-pilot.md`).
2. Baseline the remaining areas and write survivor tickets (`issues/02-baseline-and-survivor-tickets.md`).
