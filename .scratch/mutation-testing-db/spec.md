# Mutation testing: the DB-backed backend

Status: done

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

## Baseline (2026-10-24)

`pnpm --filter backend mutate:db`, all of `game/state/` (20 files; `joker-changes.ts` reused from the pilot):

| Mutants | Killed | Timeout | Survived | No coverage | Compile errors | Score (all / covered) | Run time |
| ------- | ------ | ------- | -------- | ----------- | -------------- | --------------------- | -------- |
| 1250    | 106    | 459     | 40       | 25          | 620            | 89.68% / 93.39%       | 68m18s (+1m25s initial run) |

The weakest files are `league-changes.ts` (53.85% / 58.33%), `team-player-count-changes.ts` (72.73%), `live-results-read.ts` (75%), `bonus-awards-changes.ts` and `showdowns-changes.ts` (78%), and `joker-changes.ts` (81%). The rest are at 87% or higher. `write-gate.ts` has no testable mutants.

**Timeouts dominate.** 459 of the 565 detected mutants (81%) were timeouts, not clean kills: a mutant that blanks an error or drops a guard leaves a gateway spec waiting for an event that never comes, and each one waits out the full timeout. They are the bulk of the 68 minutes, so lowering `timeoutMS` is a possible follow-up. Not done here: it risks calling slow-but-correct mutants timeouts under load.

No spec failed in the initial run (1168 tests) and none looked flaky, so there is no flaky-spec ticket.

## Tickets

1. Wire up `mutate:db` and pilot it on one file (`issues/01-wire-up-and-pilot.md`).
2. Full baseline run (about 1.5 hours, see 01's comments), then survivor tickets grouped by area, written as in `.scratch/mutation-testing/spec.md`.
3. Grading, answers and bonus awards (`issues/03-grading-answers-and-bonus-survivors.md`).
4. Joker changes (`issues/04-joker-changes-survivors.md`).
5. Team roster, player count, feedback and settings (`issues/05-team-changes-survivors.md`).
6. Showdowns, league and live results (`issues/06-showdowns-league-and-live-results-survivors.md`).
7. Screen preview, game-state service and session-write gaps (`issues/07-screen-preview-and-write-plumbing-gaps.md`).

Files with no survivors and no uncovered mutants (`commit-a-move.service.ts`, `game-progress.repository.ts`, `session-outcome.ts`, `session-updates.util.ts`, `session-write-queue.ts`) need no ticket.
