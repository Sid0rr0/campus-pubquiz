# 04: Advance and Previous settle through the same step

**What to build:** When the Move plan picks a state-machine transition, the handler runs grading exactly as today (ungraded gate, kahoot speed scoring, block batch grading, ungraded refresh), then makes one settle call, then persists — instead of assembling the phase timer, both deadlines, the break end time, the leaderboard reveal count and the closest_guess step by hand. Showdown and closest_guess sub-steps don't change progress and keep owning only their own step fields. Behaviour on stage is unchanged.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** 03 (Creation and restore go through the settle step); advance-plan 02 (One Move plan drives the handler, button availability and the /remote preview)

**Status:** done

- [x] The handler derives all progress-dependent fields for a transition with a single settle call after grading
- [x] The positional-argument phase-timer and reveal-count calls and the inline break-end-time rule exist only as the settle step's internals
- [x] Auto-lock, kahoot timer, phase timer, break end time, leaderboard reveal and closest_guess reveal behave exactly as before; the existing gateway specs covering them pass unchanged
- [x] Session creation, restore and Advance/Previous are the only callers of the settle step, and nothing else computes those fields
- [x] "Settle step" and the status group names are added to the root CONTEXT.md (create it if advance-plan hasn't yet)

## Comments

Implemented in one commit (hash in git history). After grading, the Advance/Previous handler makes one `settleSession` call with the effective action (so a raw ADVANCE under the leaderboard still counts as ADVANCE or TOGGLE_LEADERBOARD for the reveal count). Rank-reveal and leaderboard-hide steps keep the closest_guess step they had, as before. `computeQuestionLockAt` and `computeKahootQuestionEndsAt` are now private to the settle module; the phase-timer and reveal-count calls live only inside it. "Settle step" and the status groups were added to CONTEXT.md. No new tests; all gateway specs pass unchanged.

Full run: shared-types, backend and frontend green, lint clean. One real-delay kahoot spec in `state-transitions.spec.ts` flaked once under parallel load and passed alone and in the full backend run.
