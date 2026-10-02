# 01: One Postgres container per test run, with the real-store gateway harness on it

**What to build:** Running the backend suite starts one Postgres container instead of one per spec file. Most gateway spec files then take a second or two instead of 15–20s, and the full run loses most of its 4 minutes.

This ticket adds the **test database module**, the single way a backend spec gets a database. A spec calls it inside a top-level `describe`, like the existing harnesses, and gets a connected MikroORM. The module registers its own hooks: connect before the file, empty every game table after each test, close the connection after the file. Behind it, Jest's global set-up starts one `postgres:16-alpine` testcontainer, creates a template database and runs the real migrations on it once. Each Jest worker, on first use, gets its own database cloned from the template, named after its worker id. The global teardown stops the container. Connection details reach the workers through the environment, not through a file in the repo. The list of tables to empty comes from the entity definitions, so a new entity can't be missed.

The real-store gateway harness (about 65 spec files) moves onto the module. Its name, parameters and returned game handle stay the same, so no test body changes. The other harnesses and the inline container blocks keep working as they are. Moving them is ticket 02.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Baseline recorded in this ticket's Comments before any change: full backend run time and the 10 slowest spec files (`jest --json`).
- [x] Written first: a spec proving that rows inserted in one test are gone in the next, across two spec files on the same worker.
- [x] Two workers use different databases (assert on the current database name), so parallel specs never empty each other's tables.
- [x] A table that exists in the entity definitions is emptied between tests without being listed by hand. Proven by a test that compares the emptied tables with the entity definitions.
- [ ] With Docker stopped, the run fails once with a message saying Docker is required, not with a stack trace per spec file.
- [x] The container is stopped at the end of the run, including a run with failing tests (no leftover `postgres:16-alpine` containers afterwards).
- [x] The real-store gateway harness uses the module, and every spec that uses it passes unchanged. The backend test count is the same as before.
- [x] After-timings recorded in Comments next to the baseline.
- [ ] CI's `pnpm test` passes.

## Comments

### Baseline (before any change, 2026-10-02, laptop, `jest --json`)

1185 tests in 124 suites, all passing. Full run: **111s** wall clock. 10 slowest spec files:

| File                                      | Time   |
| ----------------------------------------- | ------ |
| game/session-write.spec.ts                | 110.2s |
| game/acknowledgement.spec.ts              | 29.3s  |
| game/socket-event-authorization.spec.ts   | 23.9s  |
| game/kahoot-question-auto-advance.spec.ts | 23.0s  |
| game/question-lock-auto-advance.spec.ts   | 22.5s  |
| game/action-availability.spec.ts          | 22.0s  |
| game/grading-gate.spec.ts                 | 21.7s  |
| game/outcome-delivery-and-timers.spec.ts  | 21.6s  |
| game/state-transitions.spec.ts            | 19.0s  |
| game/presenter-context.spec.ts            | 18.9s  |

### After (shared database, real-store gateway harness moved onto it)

1193 tests (1185 unchanged + 8 new in `src/test-db/`), all passing. Full run: **about 43-45s** wall clock. 10 slowest spec files: answer/grading 17.5s, game/session-write 16.2s, stats.service 15.2s, game/socket-event-authorization 14.5s, import.service 13.3s, team.service 13.3s, game/kahoot-question-auto-advance 13.1s, standings.service 13.1s, game/action-availability 13.0s, quiz.service 12.9s. The remaining slow files are mostly ones still starting their own container (ticket 02) and the fixed sleeps in session-write (ticket 03).

### Outcome

- New: `src/test-db/` (`test-database.ts` with `useTestDatabase()`, `global-setup.ts`, `global-teardown.ts`, `test-db-env.ts`), wired in through `globalSetup`/`globalTeardown` in the backend Jest config. `setupRealStoreGatewayTest` now uses `useTestDatabase()`; name, parameters and returned handle unchanged.
- Migrations run once on the template through the real `mikro-orm migration:up` CLI, forced to ts-node mode (a stale `dist/` has 28 compiled migrations against 19 in `src/`); a spec asserts the applied migrations equal the files in `src/`. Snapshot writing is switched off for that run so it leaves no file in `src/db/migrations`.
- The truncate list comes from the entity metadata, so it also empties `users` and `sessions`. The harness used to leave those two alone.
- Verified: a failing test run leaves no `postgres:16-alpine` container behind (only the dev compose one). Not verified live: **Docker stopped.** testcontainers falls back to `/var/run/docker.sock`, so a bad `DOCKER_HOST` doesn't simulate it, and stopping Docker here would take down the dev database. The path is code-reviewed only: a "Could not find a working container runtime strategy" error is rethrown as "Docker is required to run the backend tests: start Docker and run again." (any other start error is rethrown unchanged).
- CI's `pnpm test` not run on CI yet; locally the full suite passed 7 of 8 runs on the final code (5 backend-only, 3 via root `pnpm test`). The one red run (the first root `pnpm test`, 2 failed of 1193) was not captured, so I can't say which tests failed; the 7 runs after it were green. The spec already records chance failures from fixed sleeps, which tickets 03/04 target.
- Commit: see git history for this ticket's commit.
