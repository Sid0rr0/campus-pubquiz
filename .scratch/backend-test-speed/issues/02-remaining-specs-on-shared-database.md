# 02: Every remaining Postgres spec uses the shared test database

**What to build:** No backend spec starts its own Postgres container any more. The answer-service and showdown-service harnesses, and the eight specs that inline their own container, migrate and stop block, all get their database from the test database module that ticket 01 added. This is the contract step: after it, the container-per-file pattern is gone from the codebase, so a new spec can't copy it.

The harnesses keep their names, parameters and returned handles, so no test body changes. Specs that relied on starting from a brand-new database (for example seed or migration specs that check what an empty database looks like) still start from empty tables, because the module empties them after each test. Any spec that genuinely needs a fresh, unmigrated database is called out in Comments with why, and is the only exception.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 01 (One Postgres container per test run, with the real-store gateway harness on it).

**Status:** ready-for-agent

- [ ] The answer-service and showdown-service harnesses use the test database module, and their specs pass unchanged.
- [ ] The eight specs with an inline container block use the module, and pass unchanged.
- [ ] Searching the backend source for a testcontainer being started finds it only inside the global set-up (or in an exception documented in Comments).
- [ ] The backend test count is the same as before.
- [ ] Full run time recorded in Comments.
- [ ] CI's `pnpm test` passes.
