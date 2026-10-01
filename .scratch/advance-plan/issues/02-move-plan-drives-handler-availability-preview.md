# 02: One Move plan drives the handler, button availability and the /remote preview

**What to build:** Introduce the Move plan inside the Live session module: one decision that names the single step an Advance or Previous press would take (leaderboard reveal, hide leaderboard, showdown step, closest_guess sub-step, state-machine transition, or blocked with a reason), with the fixed precedence leaderboard → showdown → closest_guess → state machine. The action handler carries out the planned step, Advance/Previous availability is "the plan is not blocked", and the /remote "next" line describes the planned Advance step. Delete the Advance-availability module and the preview's hand-written next-screen mirror. Behaviour on stage and the socket contract are unchanged — this ticket only moves where the decision lives.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** 01 (Agreement walk pins today's Advance and Previous)

**Status:** ready-for-agent

- [x] The action handler no longer runs its own showdown → closest_guess → state machine sequence; it executes the Move plan's step
- [x] Transition side effects stay where they are (ungraded-answers gate on leaving a break, kahoot speed scoring, block grading, phase timers, persistence)
- [x] Advance/Previous availability in the admin view is derived from the plan; the ungraded gate and a showdown waiting for guesses still count as available and still answer with what's missing when pressed
- [x] The presenter preview's "next" line is built from the planned Advance step
- [x] The Advance-availability module and the preview's next-screen mirror are deleted; no other module restates the showdown or closest_guess step rules
- [x] The Move plan has no tests of its own; ticket 01's agreement walk and all existing gateway specs pass unchanged

## Comments

Implemented in `apps/backend/src/game/state/move-plan.util.ts` (`planMove`, `isMoveAvailable`). `Status:` left as `ready-for-agent`: the triage vocabulary has no done state.

- The handler (`GameStateService.applyAction`) executes the planned step; non-ADVANCE/PREVIOUS actions still go straight to the state machine.
- The plan covers showdown → closest_guess → state machine only. The leaderboard layer is **not** in the plan yet: putting it in would change what a raw ADVANCE does under the board and would grey out/hide Previous under the board, both on-stage changes this ticket must not make. Ticket 03 adds it. Until then `describeNextScreen` keeps its small leaderboard branch and delegates everything else to the plan.
- `action-availability.util.ts` is now `admin-view-flags.util.ts` (it keeps `getActiveBlockStartIndex`, `isShowdownEligible`, `isLastQuestionBeforeBreak`); `getActionAvailability` and the preview's showdown/closest_guess/state-machine mirror are gone.
- One existing test line changed: ticket 01's legacy-session check read `getActionAvailability`, now it reads `projectScreen(...).canGoToPreviousQuestion`. Everything else passes unchanged.
- The showdown "PREVIOUS at step 0" press is still accepted as a no-op by the handler but not offered as available, as before (`isPressable` on the showdown step).
