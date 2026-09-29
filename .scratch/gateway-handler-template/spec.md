# Spec: Collapse the gateway's per-event handler template

Status: ready-for-agent

Blocked by: `.scratch/live-session-module` issue 07 (every session change goes through a Live session operation that returns an outcome delivered by one delivery step)

## Problem Statement

Every socket event the game gateway accepts is handled by a method that repeats the same five steps by hand:

1. parse and validate the raw payload against that event's schema
2. look up the join code fixed on the socket at connect time, rejecting sockets with none
3. check the socket is in the right room (admin or players) for that event, rejecting it with a hand-written message otherwise
4. log the event with the socket id and a few payload fields
5. build a bag of dependencies and pass it, along with the join code and payload, to a free-function handler

The template is copied eleven times, which is most of the gateway. For a developer this causes the following problems:

- **Adding an event means copying the template.** It is easy to forget or get wrong the step that matters most: the room check. Nothing structural enforces that an admin-only event is admin-only. That depends on the copy containing the right room constant.
- **Authorization is scattered.** To answer "which events can a team's phone trigger?" you have to read eleven method bodies. The rule "admin actions only from the admin room" lives in eleven string-and-constant pairs.
- **Two handlers fail the deletion test.** The break-end-time and display-text-scale handlers each only set one field and rebroadcast. Deleting them and inlining their bodies loses nothing. They exist only because the template calls for a free function.
- **Dependency bags drift.** Each method hand-picks which services to pass. The picks differ per event and change whenever a handler's needs change, so the gateway churns for reasons that have nothing to do with it.
- **Misplaced documentation.** Doc comments sit on the wrong methods. The bonus-awards notification's comment is attached above the quiz-edited notification, for example.

The review's other finding about the gateway, that the timer paths hand-copy the admin Advance tail and drift from it, is fixed by the Live session spec. This spec covers what remains once that has landed.

## Solution

Each socket event is **declared once**: its event name, payload schema, the room allowed to send it, the rejection message for any other room, and which payload fields to log. One **guarded dispatch** step runs the shared template for every event: validate, resolve the session, authorize, log, run the event's body, deliver the resulting outcome. After the Live session spec lands, each event's body is a single Live session call, plus socket-level work where the event needs it (for example joining a team's room).

Quiz masters and teams see no difference. The same payloads are accepted and the same rejections arrive with the same messages. Developers get a gateway where adding an event means one declaration and one body, and where the admin-only or players-only rule sits in a single table.

## User Stories

1. As a quiz master, I want every control action I take to behave exactly as it does today, so that this refactor is invisible during a live quiz.
2. As a quiz master, I want the control panel's error toasts to show the same messages as today when an action is rejected, so that I still understand what went wrong.
3. As a quiz master, I want an invalid payload from my control panel to be rejected with the same field-specific message as today, so that bugs in the UI are still easy to diagnose.
4. As a team, I want submitting an answer, joining, leaving and making a showdown guess to behave exactly as today, so that playing on my phone is unaffected.
5. As a team, I want my phone never to be able to trigger an admin-only event, so that no team can advance the game, grade answers, kick teams or award bonuses.
6. As a quiz master, I want the admin room never to be able to impersonate a team through player-only events, so that team submissions only come from team phones.
7. As a big-screen display, I want every admin and team event to be rejected when it comes from the display room, so that the display stays read-only.
8. As any client, I want an event from a socket that isn't tied to a game session to be rejected with the same message as today, so that stale or malformed connections fail loudly rather than silently.
9. As an operator reading backend logs, I want each accepted socket event logged with its event name, socket id and the same identifying payload fields as today, so that I can reconstruct what happened during a live event.
10. As an operator, I want rejected events not to be logged as accepted, so that the logs match what actually changed.
11. As a developer, I want each socket event's schema, allowed room, rejection message and log fields declared together in one place, so that I can see an event's whole contract at a glance.
12. As a developer, I want the allowed room for every event visible in one table, so that I can audit which events each room may send without reading every handler.
13. As a developer, I want adding a socket event to require a declaration and a body and nothing else, so that I can't forget validation, session lookup, authorization or logging.
14. As a developer, I want a declaration without an allowed room to be a type error, so that an event can never ship unauthorized by accident.
15. As a developer, I want the payload type an event's body receives to be inferred from its declared schema, so that the body can't drift from what validation accepts.
16. As a developer, I want event bodies to receive the resolved join code, the parsed payload and the sending socket, so that they don't reimplement session lookup.
17. As a developer, I want event bodies to return a Live session outcome that the dispatch step delivers, so that no event can forget to push to the rooms that need it.
18. As a developer, I want the break-end-time and display-text-scale handler files deleted, so that one-line pass-throughs don't pose as modules.
19. As a developer, I want the gateway to stop hand-assembling dependency bags per event, so that changing what a body needs doesn't touch the gateway's routing code.
20. As a developer, I want the MikroORM request context still forked for every socket event, so that database access inside event bodies stays isolated per event exactly as today.
21. As a developer, I want the existing gateway specs to keep driving events through the gateway's handler methods, so that the refactor is verified at the same seam that already covers the behaviour.
22. As a developer, I want one table-driven spec to check that every declared event rejects every room other than the one it allows, so that authorization is tested exhaustively instead of spot-checked.
23. As a developer, I want the gateway's doc comments to sit on the methods they describe, so that the file can be read on its own.
24. As a developer, I want the REST-triggered notifications (session closed, settings updated, bonus awards changed, quiz edited) to keep their current entry points, so that the controllers calling them don't change.
25. As a developer, I want connection and disconnection handling to stay outside the per-event template, so that the handshake-time authentication and room assignment keep their own clearly separate path.

## Implementation Decisions

- **Socket event declaration.** A single module declares every client-to-server socket event the gateway accepts. Each declaration carries:
  - the event name (from the shared socket-events constants)
  - its payload schema, i.e. the existing per-event socket payload schemas (unchanged)
  - the one room allowed to send it (admin or players), which is required
  - the rejection message for any other room, identical to today's per-event text
  - a log summary: which payload fields appear in the "accepted" log line, matching today's fields (for example question id and team id for a submit, never the answer text)
- **Guarded dispatch.** One dispatch step, owned by the gateway, runs the template in today's order so that rejection precedence is unchanged:
  1. parse the payload with the existing parse helper, raising the same field-specific error
  2. resolve the join code from the socket, with the same "not associated with a game session" error
  3. check the room, raising the declared message
  4. log
  5. run the event body
  6. deliver the returned outcome through the Live session spec's delivery step

  The dispatch step is a plain function the gateway calls, not Nest's guard/pipe machinery. Nest's guards and pipes only run inside Nest's WebSocket pipeline, so the gateway specs, which call handler methods directly, would silently bypass authorization and validation. A plain dispatch runs identically in production and under test.
- **Gateway methods shrink to routing.** Each subscribed method keeps its event subscription and its per-event request-context fork. Its body becomes one dispatch call that names the event's declaration and supplies its body. Handler method names stay the same so the test seam and any callers are unaffected.
- **Event bodies.** An event body receives a context holding the join code, the parsed payload (typed from the declared schema) and the sending socket. It returns a Live session outcome. Most bodies are one Live session call. Bodies that must act on the socket itself keep that work in the body, for example a team joining its team room, the per-socket acknowledgement of a submitted answer, or leaving with the socket id. The body gets its dependencies from the gateway's injected services rather than a per-call dependency bag.
- **Deleted handlers.** The break-end-time and display-text-scale handler modules are deleted. Their bodies become direct Live session calls in the gateway. Other free-function handlers are kept only where they still hold socket-level logic after the Live session spec. Any that reduce to one Live session call are deleted in the same way.
- **Not in the template:**
  - Connection and disconnection keep their own path. Connect-time authentication (session cookie or team token) and room assignment differ in kind from per-event authorization.
  - Timer callbacks and REST-triggered notifications are not socket events. They call the Live session module and the delivery step directly, as the Live session spec defines.
- **Doc comments.** The notification methods' doc comments are moved onto the methods they describe while the file is reshaped.
- **Unchanged contracts:**
  - socket event names and payload shapes
  - validation rules and error messages
  - which room may send which event
  - the order of checks (payload, then session, then room)
  - log line content for accepted events
  - request-context forking per event
  - the REST notification entry points
  - connection handling

## Testing Decisions

- **One test seam: the gateway's handler methods.** This is the seam the existing gateway harness already drives. After the Live session spec, the harness is backed by the real answer, team, bonus and showdown stores. Tests connect mock sockets into rooms, call the handler methods with raw payloads, and assert on what rooms and sockets received or on the rejection raised. No new seam is introduced. The declaration table and dispatch step are not tested directly.
- **What makes a good test here.** It sends a raw payload from a socket in a given room and asserts on the visible result: the emits, the rejection type and message, or the log line. It never asserts on which internal function was called or with what arguments. Refactoring the dispatch internals must not break any test.
- **Exhaustive authorization spec.** A new table-driven spec iterates over every declared socket event. For each event it sends a well-formed payload from each room that isn't allowed, then asserts that the declared rejection arrives and that nothing was emitted to any room. Coverage then grows automatically when an event is added. A companion case sends from a socket with no session and expects the session error.
- **Rejection precedence.** One case per ordering rule keeps today's precedence pinned. An invalid payload from the wrong room yields the payload error, not the room error.
- **Existing specs as the safety net.** These must pass unchanged in intent:
  - the payload-validation, event-logging and session-room-scoping specs
  - the break-end-time, display-text-scale, showdown, grading, award-bonus and join-players specs
  - the concurrent-sessions specs

  Specs that exercised the two deleted handlers already go through the gateway, so they keep working.
- **Prior art:**
  - the socket payload validation spec (rejects via the gateway with `WsException`, then asserts nothing was emitted)
  - the socket event logging spec (spies on the logger and asserts on log content)
  - the session-room-scoping spec
  - the frontend connection-error tests, which pin the admin rejection message the control panel shows as a toast

## Out of Scope

- The Live session module itself, outcome delivery, and timer-path unification. These belong to the Live session spec, which this spec depends on.
- Changing any socket event's name, payload, validation rule, authorization rule or error message.
- Replacing the in-house payload parsing with Nest validation pipes or class-validator DTOs.
- Socket.IO acknowledgements, so that each emit gets its own success or error. That is the "role-shaped socket hooks" candidate, which also changes the frontend.
- Per-room snapshot redaction (the "Screen projection" candidate).
- Rate limiting of socket events.
- Connection-time authentication and room assignment.
- Any frontend change.

## Further Notes

- The 2026-09-30 architecture review rated this candidate "speculative" because most of its value falls out of the Live session deepening. Once handler bodies are one call each, what is left is the repeated parse/resolve/authorize/log preamble. If, after the Live session spec lands, the gateway turns out small enough that the preamble no longer hurts, the exhaustive authorization spec on its own is still worth keeping. It is the part of this spec that catches real bugs.
- The explicit per-event room declaration is also where a future moderator-vs-admin distinction on socket events would go, if one is ever needed. Today both roles share the admin room.
- No domain glossary (`CONTEXT.md`) exists yet. The terms "socket event declaration" and "guarded dispatch" are implementation vocabulary, not domain terms, and don't need glossary entries.
