# Mutation testing: the DB-backed backend

Status: ready-for-agent

The backend's `pnpm mutate` only covers the DB-free slice (README "Running mutation tests"). About 140 of the ~200 backend specs need Postgres, so Stryker never mutates `game/state/`, the server-owned game state. First audit ticket 12 turned down running the DB specs under Stryker for speed. This spec reverses that decision (2026-10-24): the game state is the riskiest code in the repo, and incremental runs make a long first run a one-time cost.

## Decisions (2026-10-24)

- **A separate command.** `pnpm --filter backend mutate:db` has its own Stryker config and its own incremental file. `pnpm mutate` and `pnpm --filter backend mutate` stay Docker-free and fast, and don't run it.
- **Mutate `game/state/**` only**, minus what `stryker.files.cjs` already leaves out (`errors/`, specs, `*.typecheck.ts`). Widening it to services, gateways and repositories is a later glob change, once the run time is known.
- **Run all specs**, DB-backed and DB-free. Per-test coverage limits each mutant to the specs that reach it.
- **One container per Stryker run.** A wrapper script starts one Postgres testcontainer (reusing the template-database code and `fsync=off` flags from `src/test-db/global-setup.ts`), sets `TEST_POSTGRES_URI`, runs Stryker, and stops the container even if the run fails. It never touches the dev (`campus_pubquiz`) or e2e (`campus_pubquiz_e2e`) databases.
- **One database per Stryker worker.** Stryker's workers each run Jest in one process, so `JEST_WORKER_ID` alone doesn't keep them apart (`src/test-db/test-database.ts` names the database `pubquiz_test_w${JEST_WORKER_ID}`).
- **No run-time cap on the first full run** (overnight is fine). Ticket 01 measures a single file and extrapolates before anyone starts a full run.
- **A flaky spec is a bug.** If one shows up under load (8 workers on one Postgres), it gets its own fix ticket, worked like follow-up ticket 01 (`.scratch/mutation-testing-followup/issues/01-flaky-team-page-throttle-spec.md`). It is not left out of the run.
- Keep memory use low: concurrency stays capped at 8, and no other test or Stryker commands run at the same time.

## Tickets

1. Wire up `mutate:db` and pilot it on one file (`issues/01-wire-up-and-pilot.md`).
2. Full baseline run (about 1.5 hours, see 01's comments), then survivor tickets grouped by area, written as in `.scratch/mutation-testing/spec.md`.
