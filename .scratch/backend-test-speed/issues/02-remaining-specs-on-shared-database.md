# 02: Every remaining Postgres spec uses the shared test database

**What to build:** No backend spec starts its own Postgres container any more. The answer-service and showdown-service harnesses, and the eight specs that inline their own container, migrate and stop block, all get their database from the test database module that ticket 01 added. This is the contract step: after it, the container-per-file pattern is gone from the codebase, so a new spec can't copy it.

The harnesses keep their names, parameters and returned handles, so no test body changes. Specs that relied on starting from a brand-new database (for example seed or migration specs that check what an empty database looks like) still start from empty tables, because the module empties them after each test. Any spec that genuinely needs a fresh, unmigrated database is called out in Comments with why, and is the only exception.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 01 (One Postgres container per test run, with the real-store gateway harness on it).

**Status:** done

- [x] The answer-service and showdown-service harnesses use the test database module, and their specs pass unchanged.
- [x] The eight specs with an inline container block use the module, and pass unchanged.
- [x] Searching the backend source for a testcontainer being started finds it only inside the global set-up (or in an exception documented in Comments).
- [x] The backend test count is the same as before.
- [x] Full run time recorded in Comments.
- [ ] CI's `pnpm test` passes. (Not run on CI yet; see Comments.)

## Comments

- Moved the answer-service and showdown-service harnesses and the eight specs (quiz, team, import, stats, seed, entities, game-progress, answer-verdict-backfill) onto the test database module. Bodies unchanged; the per-file `TRUNCATE` hooks are gone because the module empties every entity table after each test.
- **The one spec that needs no tables:** `answer-verdict-backfill.spec.ts` migrates step by step (`up({ to: previous })`, insert, `up()`), so it can't use the migrated template. Rather than keep a container for it, the module gained `useUnmigratedTestDatabase()`: an empty database on the shared container, created before the file and dropped (`WITH (FORCE)`) after. Snapshot writing is off for it so it leaves no `.snapshot-*.json` in `src/db/migrations`. It has its own spec (`test-database-unmigrated.spec.ts`). So there is no exception to the "no container outside global set-up" rule.
- Search: `PostgreSqlContainer|GenericContainer` in `apps/backend/src` now only matches `test-db/global-setup.ts` and `global-teardown.ts`.
- Test count: 1194 passing (1193 before, plus 1 new spec for the unmigrated helper). The existing 1193 are unchanged. 128 of 128 suites pass.
- Full run time: backend about **27s** wall clock under `jest` alone (about 44s after ticket 01, 111s at baseline). Root `pnpm test` takes about 43-45s including the frontend.
- CI's `pnpm test` has not run on CI yet, so the last criterion is left unticked. Locally one root `pnpm test` run was red because of `app/lib/__tests__/use-team-join-real-socket.test.ts` in the frontend, which fails about 1 run in 5 when run alone. It is flaky and not touched by this change; the backend is green.
- Commit: see git history for this ticket's commit.
