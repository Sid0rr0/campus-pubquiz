# 02: One Move plan drives the handler, button availability and the /remote preview

**What to build:** Introduce the Move plan inside the Live session module: one decision that names the single step an Advance or Previous press would take (leaderboard reveal, hide leaderboard, showdown step, closest_guess sub-step, state-machine transition, or blocked with a reason), with the fixed precedence leaderboard → showdown → closest_guess → state machine. The action handler carries out the planned step, Advance/Previous availability is "the plan is not blocked", and the /remote "next" line describes the planned Advance step. Delete the Advance-availability module and the preview's hand-written next-screen mirror. Behaviour on stage and the socket contract are unchanged — this ticket only moves where the decision lives.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** 01 (Agreement walk pins today's Advance and Previous)

**Status:** ready-for-agent

- [ ] The action handler no longer runs its own showdown → closest_guess → state machine sequence; it executes the Move plan's step
- [ ] Transition side effects stay where they are (ungraded-answers gate on leaving a break, kahoot speed scoring, block grading, phase timers, persistence)
- [ ] Advance/Previous availability in the admin view is derived from the plan; the ungraded gate and a showdown waiting for guesses still count as available and still answer with what's missing when pressed
- [ ] The presenter preview's "next" line is built from the planned Advance step
- [ ] The Advance-availability module and the preview's next-screen mirror are deleted; no other module restates the showdown or closest_guess step rules
- [ ] The Move plan has no tests of its own; ticket 01's agreement walk and all existing gateway specs pass unchanged
