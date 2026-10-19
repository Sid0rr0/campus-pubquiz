# 03: Kahoot round

**What to build:** A journey on a small CSV whose round is a kahoot round: each question locks, is scored and is revealed before the next one opens, on the big screen and the phones. Includes auto-advance and phase timers at 1 second.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Each question goes question → locking → reveal before the next.
- [x] Auto-advance and phase timer moves are recorded.
- [x] Passes `--repeat-each=5`.

Notes: `e2e/tests/kahoot-round.spec.ts` (two tests: manual flow with snapshots, and a 1-second question timer test), `e2e/fixtures/kahoot-round.csv`, `e2e/support/kahoot-session.ts`. The CSV has no kahoot column, so the helper switches the previewed round to `kahootMode` before saving. In this journey `auto_advance` is recorded for the lock countdown running out and `phase_timer` for the kahoot question timer; a kahoot choice is sent on tap (no Submit button).
