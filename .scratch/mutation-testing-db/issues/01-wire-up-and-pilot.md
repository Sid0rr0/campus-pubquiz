# 01: Wire up `mutate:db` and pilot it on one file

Status: ready-for-agent

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
