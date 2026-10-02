# 01: One Postgres container per test run, with the real-store gateway harness on it

**What to build:** Running the backend suite starts one Postgres container instead of one per spec file. Most gateway spec files then take a second or two instead of 15–20s, and the full run loses most of its 4 minutes.

This ticket adds the **test database module**, the single way a backend spec gets a database. A spec calls it inside a top-level `describe`, like the existing harnesses, and gets a connected MikroORM. The module registers its own hooks: connect before the file, empty every game table after each test, close the connection after the file. Behind it, Jest's global set-up starts one `postgres:16-alpine` testcontainer, creates a template database and runs the real migrations on it once. Each Jest worker, on first use, gets its own database cloned from the template, named after its worker id. The global teardown stops the container. Connection details reach the workers through the environment, not through a file in the repo. The list of tables to empty comes from the entity definitions, so a new entity can't be missed.

The real-store gateway harness (about 65 spec files) moves onto the module. Its name, parameters and returned game handle stay the same, so no test body changes. The other harnesses and the inline container blocks keep working as they are. Moving them is ticket 02.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Baseline recorded in this ticket's Comments before any change: full backend run time and the 10 slowest spec files (`jest --json`).
- [ ] Written first: a spec proving that rows inserted in one test are gone in the next, across two spec files on the same worker.
- [ ] Two workers use different databases (assert on the current database name), so parallel specs never empty each other's tables.
- [ ] A table that exists in the entity definitions is emptied between tests without being listed by hand. Proven by a test that compares the emptied tables with the entity definitions.
- [ ] With Docker stopped, the run fails once with a message saying Docker is required, not with a stack trace per spec file.
- [ ] The container is stopped at the end of the run, including a run with failing tests (no leftover `postgres:16-alpine` containers afterwards).
- [ ] The real-store gateway harness uses the module, and every spec that uses it passes unchanged. The backend test count is the same as before.
- [ ] After-timings recorded in Comments next to the baseline.
- [ ] CI's `pnpm test` passes.
