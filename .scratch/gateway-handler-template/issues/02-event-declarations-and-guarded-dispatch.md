# 02: Declare each event once and route it through one dispatch step

**What to build:** Every socket event the gateway accepts is declared once, in a single table. Each declaration holds:
- the event name
- the existing payload schema
- the one room allowed to send it, which is required and enforced by the type system
- today's rejection message for any other room
- which payload fields go in the "accepted" log line

One dispatch function, a plain function the gateway calls rather than Nest's guard/pipe machinery, runs the steps shared by every event in today's order:
1. validate the payload
2. look up the join code
3. check the room
4. log
5. run the event's handler
6. send the handler's result to the rooms through the live-session delivery step

Every subscribed gateway method becomes a single dispatch call. Method names and the per-event database request context stay unchanged. Each handler receives the join code, a payload typed from its schema, and the sending socket. Handlers get their dependencies from the gateway's injected services, not a per-call bag of services. Quiz masters and teams notice no difference. See the spec's Implementation Decisions ([spec](../spec.md)).

**Blocked by:** 01, and live-session-module issue 07 (handlers must already return a live-session result for the delivery step)

**Status:** ready-for-agent

- [x] Every socket event is declared in one table. A declaration with no allowed room is a type error.
- [x] Every subscribed gateway method's body is one dispatch call. No gateway method repeats the parse, find-session, room-check or log steps by hand.
- [x] Ticket 01's authorization spec iterates over the declarations instead of its own list, so adding an event automatically extends coverage, and it still passes.
- [x] The payload-validation, event-logging and session-room-scoping specs pass unchanged in intent: same error messages, same check order, same log content.
- [x] Each socket event still gets its own database request context.
- [x] Connection/disconnection handling, timer callbacks and the REST notification entry points are untouched.

## Comments

Implemented: `socket/socket-event-declarations.ts` (one table, `allowedRoom` required), `socket/guarded-dispatch.util.ts` (plain-function dispatch; bodies return a `SessionOutcome`, optionally with an `afterDelivery` hook used for kick's socket close and admin-action timer re-arming), handlers now take `(EventServices, EventContext)`. The authorization spec iterates `SOCKET_EVENT_DECLARATIONS` and fails if a declaration has no sender. Full backend suite, lint and build green. Commit: see git history (single commit covering tickets 02 and 03). `Status:` left as `ready-for-agent` since the triage vocabulary has no "done" state.
