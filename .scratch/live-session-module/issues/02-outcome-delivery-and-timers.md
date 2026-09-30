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

- [x] A regression test on the real-store harness proves that a question-lock timer expiry produces the same room emits as a manual ADVANCE from the same state, including the per-team answer sync on reveal entry.
- [x] The same holds for a kahoot question timer expiry versus a manual ADVANCE.
- [x] Admin actions, both timer paths and the settings-updated notification deliver through the one delivery step. No hand-copied action tail remains.
- [x] Timers are still re-armed after every applied action.
- [x] Admin-action error messages (illegal transition, ungraded answers blocking Advance) reach the admin unchanged.
- [x] All existing specs still pass.

## Comments

Implemented in commit `66ddeb5`. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state, and `.scratch/overview.md` records completion.

- The outcome and delivery step live in `state/session-outcome.ts`, `GameStateService.applyAdminAction` and `socket/outcome-delivery.util.ts`; `runAdminAction` is the shared path for the admin action and both timers.
- Delivery order now follows this ticket (presenter context, state snapshot, answer lists, team syncs, notices). The team sync used to be emitted *before* the snapshot on the admin path; it now follows it. Different events, so clients are unaffected.
- The lock timer only reaches a reveal-entry team sync on a kahoot round (locking goes straight to reveal); on a normal round it lands on `break_intro`. The regression tests cover both.
- `notifySettingsUpdated` is now async, and `SessionsController` awaits it.
