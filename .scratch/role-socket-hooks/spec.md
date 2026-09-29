# Spec: Role-shaped socket hooks and a Control panel context

Status: ready-for-agent

## Problem Statement

Quiz masters sometimes see a rejected action reported as a lost connection, or not reported at all. Every new admin control is also slow and error-prone to add.

- **Errors are routed by guessing.** The server has no way to tell the client which action it rejected. A rejection arrives as one untagged "exception" event. The frontend socket hook guesses who it belongs to from two "pending" flags: one for bonus awards and one for Advance. A bonus award or Advance rejection becomes a toast. Any other rejection (a kick, a grade, a break end time, a showdown round, a text scale change) becomes the persistent red connection banner on /control, which reads as though the connection dropped. The guess is also fragile, because any state update clears both flags. If a team submits an answer while the quiz master's bonus award is in flight, the resulting state update clears the bonus flag, and the award's rejection then lands in the connection banner instead of the toast.
- **Action errors and connection errors share one slot.** /control, /remote and /display decide whether to bounce back to the session picker by checking "there is an error and no snapshot yet". They can only do that because a rejected action and a refused connection are both written to the same connection-error field. On /play, a rejected team join shows up in that same field, and the join flow treats "any connection error" as a signal that the join finished.
- **One hook serves three rooms.** The frontend has a single socket hook whose result has 27 members, covering display, admin and players at once:
  - The display page uses 2 of them.
  - /control uses 13, and pads two with no-op defaults so its tests can mock the hook partially.
  - Phones use the players half through the join flow.

  Nothing stops an admin page from calling a players-only action or a phone from reading admin-only data. The hook also still exposes a bonus-award error value that nothing reads.
- **Every admin control is added in four places.** The quiz master's desktop sidebar and mobile bar render the same controls in two layouts. They share a 34-field props interface, so a new control means a new field in that interface, a new prop passed from /control twice, and a new prop unpacked in each sidebar.
- **/remote copies /control's connect and auth logic.** The presenter remote has its own copy of /control's code for joining a session and handling the login state. That covers adopting a new session code from the URL without a pointless reconnect, keeping the URL in sync with the connected session, bouncing to the session picker or login, and the "never connected" redirect. A comment says the two are kept aligned by hand. A fix to one does not reach the other.

## Solution

Every client-to-server socket event gets a Socket.IO acknowledgement. The server answers each event with a small, typed result: success, or failure with a client-safe message. Each action on the frontend returns a promise of that result. Each error then reaches the action that caused it, and no flags have to guess its owner.

The single socket hook is split into three hooks, one per room, built on a shared connection core:

- **Display game:** the snapshot and the connection state, nothing else.
- **Admin game:** the snapshot, the connection state, live answers, the presenter context, and the admin actions.
- **Player game:** the snapshot, the connection state, the team identity and link state, the team's own answers, grades, bonus awards and seen questions, and the player actions.

The connection-error field now only ever means "the connection itself is refused, lost or reconnecting". A rejected action surfaces as a toast, and the caller can also handle the returned result itself.

/control and /remote share one admin-session connection hook for their connect, URL and auth logic. /control provides a Control panel context. The desktop sidebar and mobile bar read the context instead of taking 34 props.

Nothing changes for a team or a quiz master when things go right. The visible change is that rejected actions always reach the right place.

## User Stories

1. As a quiz master, I want a rejected kick to appear as a short notice about that kick, so that I don't think my laptop lost its connection.
2. As a quiz master, I want a rejected grade to appear as a notice about that grade, so that I know the points weren't saved and can retry.
3. As a quiz master, I want a rejected bonus award to always show its own notice, even when team answers are arriving at the same moment, so that I never miss a cap or validation failure.
4. As a quiz master, I want a rejected Advance (for example, ungraded answers still outstanding) to show its reason as a notice, as it does today, so that I know what to fix before advancing.
5. As a quiz master, I want a rejected break end time, text size change or showdown round to show its reason as a notice, so that every admin control reports failure the same way.
6. As a quiz master, I want the red connection banner to appear only when the connection is actually lost or refused, so that I can trust it.
7. As a quiz master, I want the bonus award form to keep what I typed when an award is rejected, so that I can correct it and resubmit without retyping.
8. As a quiz master, I want the showdown form to keep what I typed when a showdown round is rejected, so that I can fix it and retry.
9. As a quiz master, I want repeated identical rejections (hitting the same bonus cap twice) to each show a notice, as they do today, so that a second failure isn't silent.
10. As a quiz master, I want an action sent while my laptop is disconnected to fail fast with a "not connected" notice, so that I'm not left waiting for something that will never happen.
11. As a quiz master, I want an invalid or unknown session code in the /control link to send me back to the session picker, as it does today, so that I can choose a valid session.
12. As a quiz master, I want a rejected action on a live session never to bounce me to the session picker, so that one mistake doesn't throw me out of the game.
13. As a quiz master, I want /control to keep the URL's session code in sync with the session I'm connected to, as it does today, so that a refresh lands me back in the same session.
14. As a quiz master, I want to be sent to the login page when my session expires or my account is pending, on /control and /remote alike, so that both screens behave the same.
15. As a presenter using /remote, I want the same connect, reconnect and session-switch behaviour as /control, so that a fix made for /control also helps me.
16. As a presenter using /remote, I want a rejected Advance to show its reason as a notice, so that I know to ask the quiz master to finish grading.
17. As a presenter using /remote, I want the connection banner to mean only a lost connection, so that I don't stop presenting over a rejected action.
18. As a presenter using /remote, I want switching to a different session's link not to force a reconnect when I'm already connected to it, as today, so that the preview doesn't flicker.
19. As a team, I want my answer submission confirmed exactly as today, with my saved answer and any auto-graded points, so that nothing I rely on changes.
20. As a team, I want an answer my phone sent over a silently dead connection to be resent automatically after it reconnects, as today, so that sleeping phones don't lose answers.
21. As a team, I want a rejected answer (for example, the question already locked) to show me why, without my phone treating the connection as dead, so that I understand what happened.
22. As a team, I want a rejected join (wrong code, name taken, already registered) to show its reason on the join screen, so that I can fix it and try again.
23. As a team, I want resubmitting the join form after a rejection to retry the join, as it does today, so that a typo doesn't strand me.
24. As a team, I want a later successful join to clear any earlier join error, as it does today, so that a stale error doesn't sit over a working game.
25. As a team, I want to be returned to the join screen with a notice when the quiz master removes my team, as today, so that I know what happened.
26. As a team, I want to be returned to the join screen when the quiz master closes the session, as today, so that I can join the next one.
27. As a team, I want logging out to remove my team from the roster, as today, so that it doesn't linger on the quiz master's screen.
28. As a team, I want a rejected showdown guess to tell me why, so that I can correct it before the round ends.
29. As a team, I want my phone's answered-question history to keep accumulating across rounds, as today, so that I can look back over the whole quiz.
30. As a team, I want the "not connected, hang on" notice when I submit while unlinked, as today, so that I know to wait.
31. As the big screen, I want to connect and reconnect exactly as today and to return to the session picker on an invalid code, so that the display keeps working unattended.
32. As a developer adding an admin control, I want to add it to the Control panel context and render it in both sidebars, without touching a shared props interface or /control's prop lists, so that adding one control is one small change.
33. As a developer, I want each page to receive only the members for its own room, so that the type checker stops an admin page from calling a players-only action and vice versa.
34. As a developer, I want every socket action to return a typed success-or-error result, so that I can handle a specific failure where it happens instead of in a global handler.
35. As a developer, I want the server to answer every client-to-server event with an acknowledgement, so that no client has to guess which action an error belongs to.
36. As a developer, I want connection errors and action errors in separate places, so that redirect logic never has to infer which kind it's looking at.
37. As a developer, I want /control and /remote to share one admin-session connection hook, so that the "mirrors /control" comment and its manual alignment go away.
38. As a developer, I want the unused bonus-award-error value and the "pending action" flags deleted, so that the hook has no dead state.
39. As a developer, I want the socket lifecycle (connect, identity reset on a new session, reconnect timestamp, disconnect handling) implemented once in the shared connection core, so that the three role hooks can't drift apart on it.
40. As a developer, I want hook tests to drive a faked socket transport that can answer acknowledgements, so that success and failure paths are tested as the page sees them.
41. As a developer, I want gateway tests to assert each event's acknowledgement result, so that a handler that forgets to report an error fails a test.
42. As a developer, I want page tests to mock the role hook for their room instead of the whole 27-member hook, so that the mocks stay small and typed.

## Implementation Decisions

- **Shared acknowledgement result type.** Shared types gain one acknowledgement result for every client-to-server socket event: either success (with an optional event-specific payload) or failure with a client-safe message. It follows the project's existing response-envelope convention (a success indicator, a nullable data payload and a nullable error message).
- **Server acknowledges every client-to-server event by returning the result.** Every gateway event (admin action, join players, submit answer, grade answer, kick team, leave session, set break end time, set display text scale, award bonus, create showdown round, submit showdown guess) returns an acknowledgement result from its handler method. Nest sends a handler's return value as the Socket.IO acknowledgement when the client supplies one, so no new transport machinery is needed.
  - Success is returned once the handler completes.
  - Failure, carrying the client-safe message, is returned when the handler rejects. That covers payload validation, a wrong room, and domain rejections such as illegal transitions, ungraded answers, bonus caps and a locked question.
  - Unexpected errors are logged server-side with full context and returned with a generic message, the same message the client sees today.

  The conversion from a thrown rejection to a failure result lives in plain code that the handler methods call, not in a Nest exception filter or interceptor. Gateway tests call handler methods directly, and Nest's filters and interceptors would not run there. If the gateway handler template spec lands first, this conversion belongs in its guarded dispatch step. If this spec lands first, it is one small shared wrapper that the dispatch step later absorbs.
- **Existing pushes stay.** State snapshots, answer-received, join-accepted, team-answers-synced, answers-updated, presenter context, bonus-awarded, session-closed and team-kicked pushes are unchanged. Acknowledgements are replies to the sender, not game-state events. Rejections are no longer also emitted as an untagged "exception" to the sender. Connection-level rejections at handshake (unknown session code, invalid or expired admin session) still use the existing path, because no client event exists to acknowledge.
- **Shared connection core (internal, not used by pages directly).** Owns everything today's hook does for every role:
  - the socket lifecycle and the identity reset when role, session code or retry key change;
  - the snapshot, set from state sync and state updates;
  - the connection error;
  - the reconnect timestamp.

  It exposes an internal emit-with-acknowledgement helper with a timeout. An emit made while disconnected, or one that times out, resolves to a failure result with the existing "not connected" message instead of hanging.
- **Connection error means connection only.** The connection error is set only by connect errors, server-refused connections, reconnecting and handshake-time rejections, and cleared on state sync. It is never set by an action rejection.
- **Display game hook.** Returns the snapshot and the connection error. It connects the same way as today.
- **Admin game hook.** Returns the snapshot, connection error, reconnect timestamp, live answers (with the existing REST-fold setter and the focused-question filter), presenter context, and the admin actions:
  - send action;
  - grade answer;
  - kick team;
  - award bonus;
  - set break end time;
  - set display text scale;
  - create showdown round.

  Each action returns a promise of the acknowledgement result. The hook shows a toast for every rejection by default, once per rejection even when the message repeats. Callers can await the result for inline handling, such as keeping form values after a failure. The bonus-award error value and both pending flags are deleted.
- **Player game hook.** Returns:
  - the snapshot, connection error and reconnect timestamp;
  - the team, whether the team is linked, and the kicked and session-closed signals;
  - the team's own answers, answer grades, bonus awards and seen questions.

  Its actions are join team, submit answer, leave session and submit showdown guess.
  - **Join team** returns the join acknowledgement. The join flow uses that result, rather than the connection error, to know that a join finished or was rejected, and shows the rejection on the join screen.
  - **Submit answer** keeps today's behaviour. It refuses while unlinked (with a "not connected" toast), keeps the unconfirmed answer pending, and resends it after the rejoin. The acknowledgement replaces waiting for the answer-received push as the confirmation signal. The silent-dead-socket rule stays: no acknowledgement within the existing timeout forces a fresh connection. A failure acknowledgement (for example, a locked question) clears the pending answer and shows its message without reconnecting.
- **Admin-session connection hook (shared by /control and /remote).** Takes the page's route and owns:
  - the auth gate (loading, then a redirect to login when unauthenticated or pending);
  - adopting the URL's session code only when it differs from the connected session;
  - keeping the URL in sync with the connected session;
  - redirecting to the session picker when there is no code;
  - redirecting to the session picker when the socket was refused before any snapshot arrived.

  It returns the admin game hook's result. /remote's copied logic and its "mirrors /control" comment are deleted.
- **Control panel context.** /control provides one context value holding the sidebar-facing state (status, indices, join code, quiz, connection error, the can-do flags, leaderboard, media, teams, answered teams, break end time, text scale, showdown) and the sidebar-facing actions. The desktop sidebar and mobile admin bar read it and take no shared props interface. The mobile bar keeps only its own layout props. The leaf panels (navigation buttons, admin actions, teams panel, showdown panel and so on) stay prop-driven, so /remote can keep reusing them without the context. The 34-field shared sidebar props interface is deleted.
- **Old hook removed.** When every page is on a role hook, the single three-role hook and its result type are deleted.
- **Recommended landing order:**
  1. The shared acknowledgement type and the gateway-wide acknowledgement, with gateway tests. This is additive, and today's client still works.
  2. The shared connection core and the three role hooks, with action promises and toasts. Pages switch over and the old hook is deleted.
  3. The admin-session connection hook, shared by /control and /remote.
  4. The Control panel context, with the sidebar props interface deleted.

## Testing Decisions

- **A good test drives the seam a real client uses and asserts what a user or a room would see.** It does not assert internal refs, flags or call order. For hooks, that means what the hook returns and what toasts appear after the faked server replies. For the gateway, it means the acknowledgement result the handler returns and what rooms receive.
- **Frontend seam: the faked socket.io-client transport.** Role-hook tests fake only the socket transport, as the existing real-socket join-flow test does. The fake transport is extended so each emit captures its acknowledgement callback, and a test can answer it with success or failure, or leave it unanswered to exercise the timeout. Tests cover:
  - every admin action resolving on success;
  - rejections producing a toast and never touching the connection error;
  - repeat identical rejections each producing a toast;
  - an emit while disconnected failing fast;
  - a bonus-award rejection still reaching its caller when a state update arrives while it is in flight;
  - submit confirmation, rejection and resend-after-rejoin, and the dead-socket timeout forcing a reconnect;
  - join rejection reaching the join flow;
  - identity reset on a session change;
  - display receiving only snapshot and connection state.
- **Page tests mock the role hook for their room.** /control, /remote, /play and /display page tests currently mock the whole three-role hook. They move to mocking the admin, player or display hook instead. The admin-session connection hook's redirect behaviour (never-connected code goes to the session picker, rejected action on a live session stays put, URL sync, login redirect) is covered through the /control and /remote page tests, including one /remote test for each behaviour /control already tests.
- **Backend seam: the existing gateway test harness.** Gateway tests call each event's handler method directly, as they do today. For each event they assert the returned acknowledgement:
  - success on the happy path;
  - failure with the client-safe message on validation errors, wrong-room calls and a representative domain rejection;
  - a generic message for an unexpected error.

  Existing specs that expect a handler to throw a WebSocket exception are rewritten to expect a failure result with the same message. Their "nothing was emitted" assertions are kept.
- **Prior art:**
  - the socket-hook action, connection-error, reconnect and state-sync tests;
  - the real-socket join-flow test (fake transport only);
  - the control connection and advance-controls page tests (hook mocked);
  - the gateway specs, their mock server/socket helpers, and the socket payload validation spec.
- **Regression tests first.** Before the split, add failing tests for:
  - a kick rejection landing in the connection banner;
  - a bonus-award rejection misrouted by an intervening state update;
  - a rejected action on a live /control session being treated as a connection error.

## Out of Scope

- Per-room snapshot views and server-side redaction of the hidden kahoot question. These are covered by the Screen projection spec. The seen-questions merge moves into the player hook unchanged.
- The declarative per-event template (schema, room, log fields, dispatch). That is the gateway handler template spec. This spec only adds the acknowledgement result, which that spec explicitly leaves to this one.
- Changing which state pushes each room receives, or their payloads.
- Moving REST-fetched data (quiz list, live answers load) into the socket hooks.
- Converting the leaf admin panels to read the Control panel context.
- A retry queue for failed admin actions. A rejected admin action is shown and not retried automatically.

## Further Notes

- Source: architecture review of 2026-09-30, candidate 05 ("Worth exploring"): role-shaped socket hooks and a Control panel context. The review's evidence was the 27-member hook result, the 34-field sidebar props, and error routing by "pending" flags that any state update resets. The code also shows that the bonus-award error value has no consumers, that action rejections other than bonus and Advance land in the connection banner, and that /play's join flow reads the connection error to detect a finished join.
- Interaction with the Screen projection spec: that spec types the hook's snapshot per role. If it lands first, each role hook carries its room's view type. If this spec lands first, the role hooks give that spec a natural place to put the per-role types. Either order works.
- Interaction with the gateway handler template spec: the two specs agree on where acknowledgements go. Whichever lands second moves the rejection-to-result conversion into, or keeps it in, the guarded dispatch step.
- Interaction with the Live session module spec: that spec changes what the gateway handlers call, not how they reply, so the two are independent.
- The existing silent-dead-socket timeout stays the confirmation timeout for answer submission. Admin actions use a timeout of their own (a named constant) for the "not connected" failure.
