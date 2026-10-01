# 04: Advance and Previous settle through the same step

**What to build:** When the Move plan picks a state-machine transition, the handler runs grading exactly as today (ungraded gate, kahoot speed scoring, block batch grading, ungraded refresh), then makes one settle call, then persists — instead of assembling the phase timer, both deadlines, the break end time, the leaderboard reveal count and the closest_guess step by hand. Showdown and closest_guess sub-steps don't change progress and keep owning only their own step fields. Behaviour on stage is unchanged.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** 03 (Creation and restore go through the settle step); advance-plan 02 (One Move plan drives the handler, button availability and the /remote preview)

**Status:** ready-for-agent

- [ ] The handler derives all progress-dependent fields for a transition with a single settle call after grading
- [ ] The positional-argument phase-timer and reveal-count calls and the inline break-end-time rule exist only as the settle step's internals
- [ ] Auto-lock, kahoot timer, phase timer, break end time, leaderboard reveal and closest_guess reveal behave exactly as before; the existing gateway specs covering them pass unchanged
- [ ] Session creation, restore and Advance/Previous are the only callers of the settle step, and nothing else computes those fields
- [ ] "Settle step" and the status group names are added to the root CONTEXT.md (create it if advance-plan hasn't yet)
