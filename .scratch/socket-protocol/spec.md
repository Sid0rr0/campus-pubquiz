# Spec: A typed socket protocol module, and socket-events split by concept

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-07, candidate 4 ("A typed socket protocol module; split socket-events.ts").

## Problem Statement

The socket protocol is the seam between the backend and the three clients (`/display`, `/play`, `/control` and `/remote`), and the compiler doesn't check it.

- **Nothing ties an event to its payload.** The frontend's emit-with-acknowledgement helper takes `event: string, payload: unknown`, and every listener declares its own payload type by hand. The backend emits through untyped `socket.io` servers and sockets, and the Live session module's replies and notices carry `event: string, payload: unknown`. A renamed field, a wrong payload, or a listener typed against the wrong view all compile.
- **The two `STATE_SYNC` typings have already drifted apart.** The connection core types `STATE_SYNC` and `STATE_UPDATED` per room (`StateViewByRoom[Role]`), but the phone's game hook listens to the same events typed as the shared `StateSnapshotPayload`, which isn't what the players room is sent (its `revealQuestions` differs, and it carries the phone screen, the feedback field and answerability).
- **Every room receives fields only one room reads.** `StateSnapshotPayload`, the shared base of every room view, has about 30 fields, and roughly a third of them are read by one room alone: the round categories and authors, the leaderboard reveal count and the kahoot deadline only by `/display`; the ungraded markers and the phase timer only by `/control` and `/remote`; the upcoming slots and past revealed questions only by `/play`. Each feature that adds such a field adds it to every room's view.
- **One 813-line file holds about ten concepts.** Event names and rooms, question and reveal views, the snapshot and room views, session settings, REST bodies and responses, the feedback limits and payloads, bonus awards, showdown payloads, answer payloads and the acknowledgement shape all live in one shared file. It has 81 commits, and almost every backend feature edits it.

None of this has broken on stage yet, but the drift is already there, and the next payload change that only one side picks up will compile and then fail on quiz night.

## Solution

One **socket protocol** module in shared types declares every event once: its wire name, its payload, and (for client-to-server events) what its acknowledgement carries. Server-to-client state events are declared per room, so a room's `STATE_SYNC` and `STATE_UPDATED` carry that room's view and nothing else.

Both ends type against it:

- The backend's gateway, broadcasts, connection sync and outcome delivery use `socket.io` servers and sockets typed by the protocol, and the Live session module's replies and notices name an event from the protocol with a payload of that event's type.
- The frontend's connection core opens a socket typed by the protocol, its emit-with-acknowledgement helper takes an event name and that event's payload and resolves to that event's acknowledgement, and the role hooks bind listeners on the typed socket.

A payload mismatch on either end becomes a compile error, and the phone's `STATE_SYNC` listener sees the players view because it can't see anything else.

The rest of the file splits into modules by concept, and each field that only one room reads moves out of the shared base into that room's view. Nothing changes on the wire for the people in the room: event names, payload shapes each room actually reads, acknowledgements, rooms and reconnection all behave as before. Each room simply stops receiving fields it never reads.

## User Stories

1. As a developer adding a client-to-server event, I want to declare its name, payload and acknowledgement in one place, so that both ends pick it up from that one declaration.
2. As a developer emitting from the frontend, I want the emit helper to reject a payload that doesn't match the event, so that a typo or a stale field is a compile error, not a server-side validation rejection on stage.
3. As a developer emitting from the frontend, I want the acknowledgement's result typed by the event, so that I don't have to pass a type argument by hand and can't pass the wrong one.
4. As a developer adding a listener on a role hook, I want the handler's payload type to come from the protocol, so that I can't type it against the wrong view.
5. As a developer working on `/play`, I want the phone's `STATE_SYNC` and `STATE_UPDATED` listeners to see the players view, so that merging seen questions reads the fields the players room is actually sent.
6. As a developer working on the backend, I want a reply or notice from the Live session module to name a protocol event and carry that event's payload, so that the outcome can't send a team a payload its phone doesn't expect.
7. As a developer working on the backend, I want each room's state broadcast typed by room, so that the admin view can never be sent to the players room by mistake.
8. As a developer working on the backend, I want the connection's `STATE_SYNC` typed by the connecting socket's room, so that the resync path is checked the same way as the live path.
9. As a developer adding a payload schema, I want the compiler to check that the backend's Zod schema and the protocol's payload type agree, so that the validated shape and the shape the frontend sends can't drift.
10. As a developer adding a field only `/display` reads, I want to add it to the display view alone, so that phones and `/control` aren't sent it.
11. As a developer adding a field only `/control` reads, I want to add it to the admin view alone, so that the big screen and phones aren't sent it.
12. As a developer adding a field only `/play` reads, I want to add it to the players view alone, so that its rules stay with the Screen projection's players view.
13. As a developer reading a page, I want its view type to list only what its room is sent, so that I can tell what the page may read without opening the backend.
14. As a developer touching bonus awards, I want the bonus types in their own module, so that my change doesn't touch the file every other feature edits.
15. As a developer touching feedback, I want the feedback limits and payloads in their own module, so that the limits sit next to the payloads they bound.
16. As a developer touching the showdown, I want the showdown payloads and views in their own module, so that the showdown's shapes live together.
17. As a developer touching session settings, I want the settings, their defaults and the display text-size steps in their own module, so that the REST and socket code that both read them import one concept.
18. As a developer touching REST endpoints, I want the REST bodies and responses out of the socket module, so that "socket events" means socket events.
19. As a developer importing shared types, I want every name still exported from the package root, so that the split doesn't change a single import site.
20. As a developer reviewing a backend feature, I want the diff to touch the module for that feature, so that unrelated features stop conflicting in one file.
21. As a quiz master, I want `/control`, `/remote`, `/display` and the phones to behave exactly as before, so that this change is invisible on quiz night.
22. As a team on a slow mobile connection, I want my phone to receive only what it renders, so that each state update is a little smaller.
23. As a team whose phone reconnects, I want the resync to carry the same players view as a live update, so that nothing differs between the two paths.
24. As a developer, I want the drift between the two `STATE_SYNC` typings to be impossible to reintroduce, so that one listener can't be typed differently from another for the same room.
25. As a developer writing frontend tests with the fake socket, I want the existing tests to keep working, so that typing the protocol doesn't force a rewrite of the test harness.

## Implementation Decisions

- **The protocol map is the seam.** A new socket protocol module in shared types declares:
  - the wire names (the existing `SOCKET_EVENTS` values; no event is renamed on the wire), the rooms, the handshake query and the session-room naming helper, moved here unchanged;
  - a client-to-server map from each event to `{ payload, ack }`, where `ack` is the data an acknowledgement carries (`void` for every event today);
  - a server-to-client map from each event to its payload, with an event that carries no payload (`TEAM_KICKED`) declared as such, and the connection's `exception` message included because it's on the wire;
  - the acknowledgement result shape (`AckResult`), moved here unchanged.
- **State events are typed per room.** `STATE_SYNC` and `STATE_UPDATED` carry `StateViewByRoom[R]` for room `R`. The protocol exports a room-parameterised server-to-client map (one per room), so a socket or client typed for the players room receives `PlayersStatePayload` on those events and nothing else. The frontend's connection core is already generic over the role and uses it directly. On the backend, emits to a room's state go through the one broadcast helper and the connection's sync step, each typed by the room it targets.
- **Both ends use `socket.io`'s own typed events.** The backend's server and sockets and the frontend's client socket are typed with the protocol's event maps through the `socket.io` / `socket.io-client` generics. No wrapper library and no runtime protocol object: the map is types only, and the wire names stay the existing constants.
- **The frontend's emit helper is generic over the event.** It takes a client-to-server event name and that event's payload, and resolves to `AckResult` of that event's acknowledgement. The admin hook's action emitter and every role hook's emit call follow the same signature. The `bindSocket` callback that role hooks pass receives the room-typed socket, so listeners infer their payload types.
- **The phone's `STATE_SYNC` drift is fixed by the types, not by hand.** The phone's game hook's state listeners receive `PlayersStatePayload`. The seen-questions merge takes the players view (or just the fields it reads from it).
- **The Live session module's replies and notices are typed by event.** `SocketReply` and `SocketNotice` become unions over the server-to-client events they may send, each pairing an event with its payload type, so an outcome can't carry a mismatched payload. Outcome delivery emits them through the typed server.
- **Backend event declarations name protocol events.** Each socket event declaration's `event` is a key of the client-to-server map, and a compile-time check asserts that the declaration's Zod schema's output type is assignable to that event's protocol payload. The schemas stay the runtime boundary validation; the check only keeps them in step with the type both ends use.
- **Single-room fields move out of the shared base.** The shared `StateSnapshotPayload` keeps what two or more rooms read. Starting list from today's readers (the compiler is the final word when the field is removed from the base):
  - display view only: `roundCategory`, `roundAuthor`, `roundCategories`, `roundAuthors`, `leaderboardRevealCount`, `kahootQuestionEndsAt`;
  - admin view only: `ungradedQuestionIds`, `phaseStartedAt`, `phaseElapsedMs`;
  - players view only: `upcomingQuestions`, `pastRevealedQuestions`.
  A field read by `/display` and `/control` but not `/play` (`answeredTeamIds`, `questionLockAt`, `breakEndsAt`, `displayTextScale`) stays in the base for now; narrowing the base to a display-and-admin intersection is not part of this spec. The Screen projection adds each moved field in the room's own view, the core snapshot stops building it for the others, and a room never loses a field a page in that room reads.
- **The rest of the file splits by concept**, one module each, with the package root re-exporting all of them so no import site changes:
  - socket protocol (above);
  - question views: the question, reveal, block, pending closest_guess reveal, upcoming position and round title views, and the closest_guess reveal data;
  - room views: the shared snapshot, the display, admin and players views, `StateViewByRoom`, the leaderboard entry, the team view, the Advance slot step, the Previous state and the presenter context;
  - answers: submit, received, team answer, answer view, answers updated, grade, team answers synced, the "I don't know" value;
  - team presence: join, join accepted, kick, leave, session closed;
  - session settings: `SessionSettings`, its frozen default, the display text-size steps and default, the kahoot timer default;
  - bonus: categories, award payload, team and admin award views, the awarded payload, the awards list and update bodies;
  - feedback: the comment and topic limits, the round rating and team feedback views, the rate-round and send-feedback payloads;
  - showdown: the create and guess payloads, the participant and active showdown views;
  - REST bodies and responses that aren't covered above (quiz summaries and listing, session creation, active session summary) move to a REST module.
  Exact module names follow the shared types package's existing naming; a type that two concepts use sits in the lower-level one and the other imports it.
- **No wire, schema or behaviour change beyond the trimmed fields.** Event names, payload shapes that pages read, acknowledgements, rooms, authorisation, the session write and reconnection are unchanged. No database or migration change.
- **Docs, in the same change:**
  - `DOCUMENTATION.md`'s Real-Time Protocol section says every event is declared once in the protocol map that the gateway and the clients type against; its snapshot table says which fields are the shared base and which belong to one room's view; its event list is brought in line with the map (it still names `SELECT_QUIZ` and omits the newer events).
  - `CODING_STANDARDS.md`'s Boundaries section gains: "A socket event is declared once, in the socket protocol map; both ends emit and listen through sockets typed by it, never with a hand-written payload type. A field only one room reads goes in that room's view, not the shared snapshot."
  - `docs/architecture.md`'s connection diagram notes the typed protocol if it names the shared types file.
  - `GLOSSARY.md` is unchanged: no domain term changes.

## Testing Decisions

- **Seams (agreed with the user):** the compiler, plus the existing runtime suites. No new runtime harness.
- **A good test here checks what crosses the seam, not how the types are built.** For the compiler seam that means type-level assertions in shared types, compiled by the workspace typecheck: a wrong payload for an event is an error (`@ts-expect-error`), an acknowledgement resolves to the event's type, a room's `STATE_SYNC` is that room's view and not another's, and a players view doesn't expose an admin-only field. Prior art for shared-types tests is the existing shared types test folder; the assertions live next to them.
- **Schema agreement** is a compile-time assertion beside the socket event declarations: each declaration's schema output is assignable to its protocol payload, so adding a field to one without the other fails typecheck.
- **Backend runtime behaviour is pinned by the existing gateway specs** (mock socket and mock server from the game test utils): socket payload validation, event authorisation, outcome delivery order, screen projection delivery, room scoping, the players view and reveal redaction, past revealed questions, and connection. They keep passing; specs that read a moved field from a room that no longer receives it are updated to read it from the room that does. Screen projection and core snapshot specs gain assertions that each moved field appears in its own room's view and not in the others.
- **Frontend runtime behaviour is pinned by the existing role-hook tests on the fake socket** (connection core, player game, admin game, display game, team join on a real `usePlayerGame`). They keep passing unchanged apart from typings. The fake socket may stay loosely typed; giving its `trigger` a typed overload is allowed but not required.
- **Page tests** that build fixtures with a moved field on the wrong room's view are updated with it; a page that compiled against a field its room no longer receives is a bug the change surfaces, not one to paper over with a default.
- The pre-commit hook and CI already run `typecheck` across workspaces, so the compiler seam runs on every commit.

## Out of Scope

- Removing the pass-through socket handlers or moving timer re-arming into `SessionOutcome` (review candidate 9).
- Sharing the Screen projection with frontend fixtures (review candidate 8).
- Runtime validation of server-to-client payloads on the frontend.
- Renaming wire event strings, rooms or the handshake query.
- Narrowing the shared base to the display-and-admin intersection, or splitting `StateSnapshotPayload` further than moving single-room fields.
- Typing the REST API end to end (the REST types only move module).
- Acknowledgements that carry data: the map supports them, but no event starts returning data in this change.

## Further Notes

- The list of single-room fields was taken from today's page and hook reads (with `/control` and `/remote` counted as the admin room). If a field turns out to be read by a second room, it stays in the base; the type checker will say so as soon as the field is removed.
- This is the seam candidate 9 (handler removal, `SessionOutcome` deadline changes) would build on: typed replies and notices make it safer to route more through `SessionOutcome` later.
- Splitting the file is mechanical and can land as its own first ticket, before the protocol map, so that the typing change reviews as a small diff on top of already-moved types.
