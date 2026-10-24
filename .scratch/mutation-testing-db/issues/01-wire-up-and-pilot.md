# 01: Wire up `mutate:db` and pilot it on one file

Status: done

Blocked by: None

**Type:** task

Add `pnpm --filter backend mutate:db` as decided in the spec, and run it on one file to measure it.

Check these two things against the Stryker docs or a quick trial before building on them:

- **Does Stryker's Jest runner run `globalSetup` once per mutant?** If it does, the Stryker Jest config must drop `globalSetup`/`globalTeardown` (as `jest.stryker.config.cjs` already does), and the wrapper owns the container.
- **Does each Stryker worker get a unique id?** Stryker is believed to set `STRYKER_MUTATOR_WORKER`. If so, use it in the per-worker database name in `test-database.ts`, with `JEST_WORKER_ID` as the fallback outside Stryker, and make sure each worker's database gets cloned from the template.

Then:

- Pilot on one mid-sized file, for example `src/game/state/joker-changes.ts`: `--mutate` that file only.
- Record in `## Comments`: the initial test run time, the mutant count, the wall time and time per mutant, and an extrapolation for all of `game/state/**`.

Done when:

- `pnpm --filter backend mutate:db` runs end to end against its own testcontainer and leaves no container behind (including after a Ctrl-C or a failed run);
- the pilot file's results are in its own incremental file, separate from `reports/stryker-incremental.json`;
- the existing `pnpm --filter backend mutate` and `pnpm --filter backend test` work unchanged;
- the README "Running mutation tests" section and the `pnpm mutate` line in `CLAUDE.md` describe `mutate:db` (what it covers, that it needs Docker, that it's slow), in the same commit;
- the measurements are in `## Comments`.

## Comments

**The two unknowns (checked in Stryker 10.1.1's source):**

- `globalSetup` would run once per mutant: the Jest runner calls `runCLI({ runInBand: true })` for every test run (`jest-test-adapter.js`). So `jest.stryker-db.config.cjs` keeps the DB-free config's lack of a global set-up, and `src/test-db/mutate-db.ts` calls `global-setup.ts`/`global-teardown.ts` once around the Stryker process.
- Each worker gets a unique id: Stryker forks every worker with `STRYKER_MUTATOR_WORKER` set (`child-process-proxy.js`). `workerDatabaseName()` in `test-database.ts` now uses `pubquiz_test_s<id>` when it's set, and `pubquiz_test_w<JEST_WORKER_ID>` otherwise. A worker restarted after a timeout gets a new id and clones a fresh database; the container is thrown away, so the leftovers don't matter.

**Pilot: `pnpm --filter backend mutate:db --mutate src/game/state/joker-changes.ts` (2026-10-24)**

| Mutants | Killed | Timeout | Survived | No coverage | Compile errors | Score (all / covered) |
| ------- | ------ | ------- | -------- | ----------- | -------------- | --------------------- |
| 170     | 32     | 33      | 12       | 3           | 90             | 81.25% / 84.42%       |

- Initial test run: 1148 tests in 1m24s, in band in one process (`dryRunTimeoutMinutes` is 20 to leave room).
- Total wall time 8m16s, so about 6m50s for the 80 mutants that compiled (about 5s each; concurrency 8 splits into 4 checker and 4 test runner processes), 4.75 tests per mutant. CPU about 5 cores on average; no swap pressure seen.
- The compile errors are the TypeScript checker dropping mutants, as in the other runs.
- The timeouts look like real kills: a blanked error message or a dropped guard leaves a gateway spec waiting for an event that never comes. They are the slow part, since each one waits out the full timeout.
- Twelve survivors, e.g. `touchedScores: true → false` at line 141 and `status !== 'joker_pick' && … → true` at line 214. Ticket 02's survivor tickets will handle them.

**Extrapolation.** `joker-changes.ts` is 344 of the 3769 lines in `game/state/` (9%), so a full run should take about 75 minutes plus one initial run: roughly 1.5 hours.

**Checked:** no container left behind after a normal run or after SIGINT to the process group mid-run; the DB-free `reports/stryker-incremental.json` was not touched; `pnpm --filter backend test` (207 suites, 3303 tests), typecheck and lint pass.
