# Spec: Split outbound broadcasting out of the GameGateway

Status: done

Source: architecture review 2026-10-13, candidate 04 ("Worth exploring", ports & adapters).

## Problem Statement

The game gateway is the Socket.IO transport class. It should only turn incoming socket events into Live session calls, but today it also owns everything that goes *out* to clients, and the rest of the backend reaches into it for that:

- **A domain module depends on the transport.** The Live edit module's save hands its outcomes to the gateway (`deliverSessionOutcome`) once its hold is released. The rule "after a quiz edit, tell the rooms" depends on the class that decorates socket handlers, so the Live edit module can't be built or reasoned about without the transport.
- **Three REST controllers depend on the transport.** The users controller calls the gateway to drop a deactivated user's admin sockets. The sessions controller calls it to rebroadcast after a settings change and to tell players a session was closed. The bonus-award mutations controller calls it after an out-of-band bonus edit. Each one imports the whole gateway, all eleven socket handlers included, to use one method.
- **The gateway holds dependencies it doesn't use.** It is injected with AnswerService only so it can pass it to the delivery step, which reads answer lists and team answer syncs. It is injected with the ORM and the timer schedulers only so it can build the phase timers.
- **The bonus notification hides a session write.** `notifyBonusAwardsChanged` looks like a broadcast but first runs a bonus-changed Live session write. A reader of the controller can't see that a write happens.
- **Delivery has one adapter, the gateway's server field.** Tests patch a mock server onto the gateway after constructing it. The mock server already acts as a second adapter for outbound delivery, but nothing names that seam.

For a developer, adding a new out-of-band notification (a new REST edit that live clients must see) means adding another public method to the transport class. Changing how outcomes are delivered means editing the class that also handles every inbound event.

## Solution

A new **Session broadcaster** provider owns all outbound delivery to connected clients:

- the one delivery step that turns a session outcome into emits (replies, the state broadcast, admin answer lists, team answer syncs, notices, socket closes)
- the phase timers, because delivery re-arms them and their expiries are delivered like any other outcome
- the narrow one-off pushes: telling players a session was closed, and disconnecting a deactivated user's sockets

The gateway becomes inbound only. It accepts connections, dispatches socket events to the Live session and hands each resulting outcome to the Session broadcaster. It gives the broadcaster the Socket.IO server once the server exists. The Live edit module and the REST controllers depend on the Session broadcaster, never on the gateway.

Quiz masters, teams and the big screen see no difference. Every event, broadcast, notice and disconnect arrives exactly as it does today, in the same order. Developers get a transport class that only handles incoming events, and one place that answers "what can the backend push to clients, and how?"

## User Stories

1. As a quiz master, I want every control action to update /control, /display and phones exactly as it does today, so that this refactor is invisible during a live quiz.
2. As a quiz master, I want the question lock and kahoot question timers to keep auto-advancing exactly as today, so that timed blocks still end on their own.
3. As a quiz master, I want timers to be re-armed after a backend restart exactly as today, so that a redeploy mid-countdown still ends the countdown.
4. As a quiz master, I want a quiz edit saved during a live session to reach every running session's rooms as today, so that /display and phones show the corrected question straight away.
5. As a quiz master, I want a failed delivery after a live edit not to hide the error that failed the save, as today, so that the editor still shows the real reason.
6. As a quiz master, I want changing a session's settings over REST to rebroadcast the session state, so that /display, /control and /rules pick up the change immediately.
7. As a quiz master, I want editing or deleting a bonus award over REST to update every room's bonus totals, so that nobody sees a stale total.
8. As a quiz master, I want a bonus edit for a session that isn't live to change nothing on any socket, as today, so that out-of-band edits stay harmless.
9. As a team, I want to be told when the session I'm in is closed, so that my phone doesn't fail later with an opaque "Unknown game session" error.
10. As a team, I want the session-closed notice to reach only the players room, as today, so that the closing admin and /display are unaffected.
11. As an admin, I want deactivating a user to disconnect every open /control socket of theirs immediately, so that a deactivated moderator loses admin powers at once.
12. As an admin, I want deactivating one user to leave other users' and players' sockets connected, so that nobody else is kicked by mistake.
13. As a team, I want my answer-received and join-accepted replies to arrive only on my own socket, as today, so that other phones never see them.
14. As a team, I want my answer syncs and kick and bonus notices to reach only my socket, as today, so that per-team data stays private.
15. As a quiz master, I want admin answer lists to reach only the admin room, as today, so that teams never see other teams' answers.
16. As a team, I want a kicked team's socket to still be closed even when an earlier emit fails, as today, so that a kick always takes effect.
17. As a developer, I want the Live edit module to depend on the Session broadcaster and not on the gateway, so that the domain no longer depends on the transport.
18. As a developer, I want the REST controllers to depend on the Session broadcaster and not on the gateway, so that they import only what they use.
19. As a developer, I want the bonus-awards controller to run the bonus-changed Live session write itself and hand its outcome to the broadcaster, so that the write is visible where it happens.
20. As a developer, I want the gateway to stop holding AnswerService, the ORM and the timer schedulers, so that its constructor lists only what inbound handling needs.
21. As a developer, I want every outbound path (socket event, timer expiry, live edit, REST notification) to go through the same delivery step, so that delivery order is defined once.
22. As a developer, I want to add a new out-of-band notification by adding it to the Session broadcaster, so that the gateway doesn't grow for reasons unrelated to incoming events.
23. As a developer, I want the mock socket server to be the broadcaster's test adapter, so that delivery can be tested without a gateway.
24. As a developer, I want the gateway's test surface to shrink to inbound behaviour (connection, validation, authorization, dispatch), so that gateway specs say what the gateway is for.
25. As a developer, I want the architecture diagram and glossary to name the Session broadcaster, so that the next reader finds the outbound side without reading the gateway.

## Implementation Decisions

- **New provider: Session broadcaster.** A Nest provider in the game module's socket area, registered in the app module next to the gateway. It is the only code outside the gateway that touches the Socket.IO server.
- **Session broadcaster interface:**
  - `deliver(joinCode, outcome, sender?)`: the existing delivery step, unchanged in behaviour and order (re-arm timers from the deadline change first, then replies to the sender, presenter context, state broadcast, admin answer lists, team syncs, notices, and socket closes in a `finally`). `sender` stays optional for outcomes no socket sent.
  - `broadcastState(joinCode)`: shorthand for delivering the existing broadcast-state outcome. It replaces the gateway's `notifySettingsUpdated`.
  - `notifySessionClosed(joinCode)`: the narrow session-closed emit to the players room only. Moved unchanged.
  - `disconnectUser(userId)`: disconnects every socket whose authenticated user has that id. Moved unchanged.
  - `attach(server)`: called by the gateway once the Socket.IO server exists.
- **Server hand-off.** The gateway keeps `@WebSocketServer()` (Nest only injects the server into gateways). It implements the gateway init hook and passes the server to `attach`. Calling `deliver` or a notify method before `attach` is a programming error and throws a clear error, so nothing is ever silently lost. In production the server is attached during app init, before any connection, REST request or timer expiry.
- **Phase timers move into the Session broadcaster.** The broadcaster builds the phase timers with its own `deliver` as their delivery callback, and passes itself to `deliver` as the re-arm hook. The timer-scheduler injection token moves with them. The broadcaster takes over both lifecycle hooks: on application bootstrap it restores every stored session's deadlines, and on module destroy it clears all timers. This removes the closure the gateway uses today to break the timers ↔ delivery cycle.
- **The gateway becomes inbound only.** Its constructor takes the Live session façade (GameStateService), the auth SessionService and the Session broadcaster. AnswerService, the ORM and the timer schedulers leave it. Guarded dispatch and disconnect handling get the broadcaster's `deliver` instead of the outcome-delivery dependency bag. The join-players handler still reads socket liveness from the gateway's own server, since that is inbound work.
- **The delivery step's dependencies stay internal.** AnswerService (answer lists and team syncs), the Live session façade (snapshots, session ids) and the server are the broadcaster's own dependencies. No caller builds a dependency bag.
- **Callers move off the gateway:**
  - Live edit module: injects the Session broadcaster and calls `deliver` for each pending delivery after the hold is released. Its swallow-on-failure handling is unchanged.
  - Users controller: calls `disconnectUser` on the broadcaster, after deactivating as today.
  - Sessions controller: calls `broadcastState` after persisting settings and `notifySessionClosed` after evicting the session.
  - Bonus-award mutations controller: runs the bonus-changed Live session write itself (it already has the façade) and passes the outcome to `deliver`. The gateway's `notifyBonusAwardsChanged` and `deliverSessionOutcome` are removed.
- **No public outbound methods are left on the gateway.** After this change nothing outside the gateway's own file imports it, apart from the app module and tests.
- **No protocol, payload or ordering change.** Socket event names, payloads, rooms and the order of emits are identical. No shared-types change.
- **Docs in the same change:** the architecture diagram shows controllers, Live edit, phase timers and the gateway all pointing to the Session broadcaster, which points to the Socket.IO adapter, and the "timers → gateway" and "rest → gateway" edges go away. GLOSSARY gains a **Session broadcaster** entry (what the backend pushes to connected clients, and the one delivery step for every outcome). DOCUMENTATION.md and the /guide page are unaffected because behaviour doesn't change.

## Testing Decisions

- **What makes a good test here:** it drives the system the way production does and asserts on what clients receive, meaning emits captured on the mock server and its sockets, never on which internal method ran. A pure refactor proves itself when the existing behavioural specs pass unchanged in what they assert. Only how they reach the outbound methods changes.
- **Primary seam: the real-store harness**, which already builds the module over Postgres with the mock socket server and manual timer schedulers. The harness constructs the Session broadcaster, attaches the mock server to it through the gateway's init hook (as Nest would), passes it to the gateway and the Live edit module, and exposes it next to the gateway on the returned handle. This is the one seam the change adds, and it sits on an existing one.
- **Specs that call outbound methods on the gateway retarget the broadcaster**, with assertions unchanged: disconnect-user, notify-session-closed, bonus-changed (now through the controller-equivalent path: bonus-changed write, then `deliver`), outcome-delivery-deadlines, and anything else using `game.gateway.notify*`, `disconnectUser`, `deliverSessionOutcome` or `server`.
- **Timer specs** (phase-timer lifecycle, question lock and kahoot timers, restart) keep driving through the harness's manual schedulers and `restart()`. They now cover the broadcaster's bootstrap and destroy hooks instead of the gateway's.
- **New broadcaster cases**, written test-first in the real-store style:
  - delivering before `attach` throws a clear error and emits nothing
  - `broadcastState` sends the same per-room snapshots as an admin action that only rebroadcasts
  - an outcome delivered from outside a socket event (no sender) sends no replies but everything else, in the usual order (prior art: outcome-delivery-order)
- **Controller unit specs** (users, sessions, bonus-awards) swap their fake gateway for a fake Session broadcaster. The bonus-awards spec additionally asserts that the bonus-changed write runs and its outcome is delivered, and that neither happens when the edit is rejected. Prior art: the existing controller specs' hand-rolled fakes.
- **Live edit specs** (live-edit regrade, live structural edit, quiz-edited) keep asserting on room emits through the harness's `saveQuizEdit`. No changes beyond wiring.
- **No new Nest-module test** is required. Wiring is checked by the app booting (`pnpm dev:backend`) and by typecheck. Building the harness from the real module is candidate 03 and stays separate.
- Run with `pnpm --filter backend test <path>` per touched spec, then the full backend suite and `pnpm typecheck`.

## Out of Scope

- Building the test harness from the real Nest module (review candidate 03). This spec only rewires the hand-built harness.
- Changing the delivery order, the outcome shape, or what a session outcome can contain.
- Splitting the delivery step into per-room projections or changing how snapshots are built.
- Any protocol, payload, room or frontend change.
- Horizontal scaling or a Redis adapter. A single backend instance is an accepted constraint. The broadcaster does not open a door to it.
- Moving inbound concerns (connection acceptance, guarded dispatch, socket event declarations) out of the gateway.
- Renaming GameStateService or other existing modules.

## Further Notes

- This is a pure refactor. Any spec whose *assertions* need changing means behaviour drifted and should be investigated, not updated.
- Order of work that keeps the suite green at every step: (1) introduce the broadcaster with `deliver` and the timers, with the gateway delegating to it; (2) move the Live edit module and the controllers over; (3) delete the gateway's outbound methods and unused dependencies; (4) update the architecture diagram and glossary.
- Pairs well with candidate 03. Once the harness is built from the Nest module, the broadcaster's `attach` is the natural place to override the socket server adapter.
- Commit scope is `backend` for code and `repo` for the docs changes.
