# 07: Remaining events through the module; delete the pass-through setters

**What to build:** These last session changes move behind event-shaped Live session operations that return outcomes delivered by the single delivery step:
- team connected / disconnected
- break end time and display text scale
- showdown setup and guesses

With every caller migrated, the read-spread-write mutations layer is deleted and the field-level setters leave the module's interface: leaderboard, teams, answered-team ids, graded status and the other one-line setters. Nothing outside the module can put the session record in an inconsistent state. See the spec's user stories 24–26 and 33 ([spec](../spec.md)).

**Blocked by:** 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] Connection presence, break end time, display text scale and showdown flows behave exactly as today (existing specs pass).
- [ ] The mutations layer no longer exists. The Live session interface exposes only event operations plus the read-only queries listed in the spec.
- [ ] No socket handler, timer callback or REST notification emits game-state events except through the delivery step.
- [ ] The concurrent-sessions isolation specs still pass: one session's events never refresh or push to another session's rooms.
- [ ] Restart recovery (progress and timers restored from persistence) behaves exactly as today.
