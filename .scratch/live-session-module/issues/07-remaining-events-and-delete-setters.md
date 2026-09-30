# 07: Remaining events through the module; delete the pass-through setters

**What to build:** These last session changes move behind event-shaped Live session operations that return outcomes delivered by the single delivery step:
- team connected / disconnected
- break end time and display text scale
- showdown setup and guesses

With every caller migrated, the read-spread-write mutations layer is deleted and the field-level setters leave the module's interface: leaderboard, teams, answered-team ids, graded status and the other one-line setters. Nothing outside the module can put the session record in an inconsistent state. See the spec's user stories 24–26 and 33 ([spec](../spec.md)).

**Blocked by:** 03, 04, 05, 06

**Status:** ready-for-agent

- [x] Connection presence, break end time, display text scale and showdown flows behave exactly as today (existing specs pass).
- [x] The mutations layer no longer exists. The Live session interface exposes only event operations plus the read-only queries listed in the spec.
- [x] No socket handler, timer callback or REST notification emits game-state events except through the delivery step.
- [x] The concurrent-sessions isolation specs still pass: one session's events never refresh or push to another session's rooms.
- [x] Restart recovery (progress and timers restored from persistence) behaves exactly as today.

## Comments

Implemented in the commit recorded in `.scratch/overview.md`. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state, and the overview records completion.

- `GameStateService` gained event operations `teamConnected`, `teamDisconnected` (null when the socket held no team), `breakEndTimeSet`, `displayTextScaleSet`, `showdownRoundCreated` and `showdownGuessSubmitted`; each returns a `SessionOutcome` that the handler passes to `deliverOutcome`.
- `GameSessionMutationsService` and every field-level setter (leaderboard, teams, answered-team ids, graded status, leaderboard visibility, team connection) are gone. Their logic lives as pure `with…` transforms in `session-updates.util.ts`, applied only inside the module's event operations.
- `handleDisconnect` and the break-end-time / text-scale handlers are now async so they can await the delivery step.
- Specs still on the fake-store harness that arranged state through the deleted setters now use a test-only `arrange(service)` helper in `test-utils.ts`; it goes away when 08/09 migrate them. `team-presence.spec.ts` was rewritten against `teamConnected`/`teamDisconnected`. New real-store spec: `remaining-events.spec.ts`.
