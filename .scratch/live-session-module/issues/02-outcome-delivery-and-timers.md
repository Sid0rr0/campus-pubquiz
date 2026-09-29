# 02: Outcome delivery step; timers share the Advance path

**What to build:** Applying an admin action in the Live session module returns an **outcome**:
- whether to broadcast state
- which question ids need a fresh admin answer list
- which teams need a per-team answer sync
- any per-socket notices

A single delivery step in the socket layer turns an outcome into emits, in today's order:
1. presenter context to admin
2. state snapshot to all three rooms
3. admin answer lists and team syncs
4. notices

The admin ADVANCE/action path, the question-lock timer expiry and the kahoot timer expiry all go through this one operation plus delivery, so a timer-driven lock behaves exactly like the quiz master pressing Advance. The reveal-entry team sync is decided inside the outcome from the actual transition, not special-cased per caller. See the spec's Implementation Decisions ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A regression test on the real-store harness proves that a question-lock timer expiry produces the same room emits as a manual ADVANCE from the same state, including the per-team answer sync on reveal entry.
- [ ] The same holds for a kahoot question timer expiry versus a manual ADVANCE.
- [ ] Admin actions, both timer paths and the settings-updated notification deliver through the one delivery step. No hand-copied action tail remains.
- [ ] Timers are still re-armed after every applied action.
- [ ] Admin-action error messages (illegal transition, ungraded answers blocking Advance) reach the admin unchanged.
- [ ] All existing specs still pass.
