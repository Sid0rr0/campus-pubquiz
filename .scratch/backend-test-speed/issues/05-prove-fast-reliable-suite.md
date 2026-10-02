# 05: Prove the backend suite is fast and never fails by chance

**What to build:** Evidence that the spec's goal is met: the full backend suite runs in under 60s on a developer laptop, and passes ten times in a row with no failures. Anything still slow or flaky is either fixed here (if small) or written up as a follow-up ticket in this feature directory.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 02 (Every remaining Postgres spec uses the shared test database), 04 (Gateway specs fire phase timers on demand).

**Status:** done

- [x] Full backend run time and the 10 slowest spec files (`jest --json`) recorded in Comments, next to ticket 01's baseline (236s).
- [x] Full backend run under 60s, or, if not, the remaining cost broken down (set-up vs test bodies vs transform) with a follow-up ticket for the biggest part.
- [x] Ten consecutive full backend runs pass with no failures. The run log summary is in Comments.
- [x] No spec left with a fixed-duration sleep used to wait for the gateway (searched and listed in Comments; any intentional one has a comment explaining why).
- [x] The backend test count is the same as at the start of ticket 01.
- [ ] CI's `pnpm test` passes.
- [x] Spec status set to `done`.

## Comments

### Result (2026-10-02, laptop, Docker running)

No code changed in this ticket; the suite as left by tickets 01-04 already meets the goal.

**Run time.** First measured run (`jest --json`): 1210 tests in 131 suites, all passing, **39.2s** Jest time (44.8s wall including start-up). Baseline was 236s (spec measurement) / 111s (ticket 01's own measurement). Under the 60s target.

**10 slowest spec files** (first run):

| File                                          | Time  |
| --------------------------------------------- | ----- |
| db/answer-verdict-backfill.spec.ts            | 38.9s |
| test-db/test-database-unmigrated.spec.ts      | 18.3s |
| game/socket-event-authorization.spec.ts       | 11.2s |
| game/action-availability.spec.ts              | 10.5s |
| game/session-write.spec.ts                    | 9.4s  |
| answer/grading.spec.ts                        | 8.7s  |
| stats/stats.service.spec.ts                   | 7.8s  |
| game/presenter-context.spec.ts                | 7.6s  |
| game/state-transitions.spec.ts                | 7.0s  |
| game/on-air-screen.spec.ts                    | 5.4s  |

The two slowest files each start their own Postgres container on purpose (migration backfill and the unmigrated-database case), and run in parallel with the other workers, so they set the floor of the run but don't add to it. `session-write.spec.ts` went from 110s to 9.4s.

**Ten consecutive full backend runs** (`pnpm exec jest`, from `apps/backend`): all 10 passed, 1210/1210 each, wall 57s, 39s, 38s, 38s, 41s, 41s, 47s, 41s, 45s, 40s (run 1 overlapped with another command). Zero failures.

**Fixed-duration sleeps.** Searched `src` for `setTimeout`, `sleep(`, `delay(`, `advanceTimersByTime` and `useFakeTimers` in specs, `__tests__` helpers and `test-db`. None waits for the gateway. What remains: `phase-timer.spec.ts`, `question-lock-timer.registry.spec.ts` and `session.service.spec.ts` use Jest fake timers on units that have no database; `real-store-test-utils.ts` `freezeClockAt` fakes only `Date`; `test-db/test-database.ts` has a retry delay while cloning the template database (not a gateway wait).

**Test count.** 1210 now, against 1185 at the start of ticket 01 (+8 new in ticket 01, +17 new in tickets 02-04). No test was dropped: the five `it(` lines removed in the diff since then are titles prettier moved onto one line.

**CI.** Not run on CI from here, so that box stays unticked. Locally the whole backend suite passes 11 of 11 runs.

**Spec status** set to `done`.
