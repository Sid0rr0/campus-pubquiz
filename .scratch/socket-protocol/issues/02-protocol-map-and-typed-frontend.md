# 02: The protocol map, and the frontend typed against it

**What to build:** Every socket event is declared once, in a protocol map in the socket protocol module, and the frontend emits and listens through it. A developer who sends the wrong payload, reads the wrong acknowledgement type or types a listener against the wrong view gets a compile error. The phone's `STATE_SYNC` and `STATE_UPDATED` listeners see the players view, the view the players room is actually sent, which fixes the drift where the phone's game hook typed them as the shared `StateSnapshotPayload`.

The map declares:

- a client-to-server map from each event to `{ payload, ack }` (`ack` is `void` for every event today);
- a server-to-client map from each event to its payload, with `TEAM_KICKED` declared as carrying none and the connection's `exception` message included;
- `STATE_SYNC` and `STATE_UPDATED` per room: a room-parameterised server-to-client map, so a socket typed for room `R` receives `StateViewByRoom[R]` on those events.

The map is types only. Wire names stay the existing `SOCKET_EVENTS` constants, and no event is renamed.

On the frontend:

- The connection core opens a `socket.io-client` socket typed by the room's maps.
- The emit-with-acknowledgement helper takes a client-to-server event name and that event's payload, and resolves to `AckResult` of that event's acknowledgement.
- The admin hook's action emitter and every role hook's emits follow the same signature.
- The `bindSocket` callback receives the room-typed socket, so listeners infer their payload types.
- The seen-questions merge takes the players view, or just the fields it reads from it.

Docs, in the same change:

- `DOCUMENTATION.md`'s Real-Time Protocol section says every event is declared once in the protocol map, and its event list matches the map (drop `SELECT_QUIZ`, add the newer events).
- `CODING_STANDARDS.md`'s Boundaries section gains the rule: "A socket event is declared once, in the socket protocol map; both ends emit and listen through sockets typed by it, never with a hand-written payload type. A field only one room reads goes in that room's view, not the shared snapshot."

Parent spec: `.scratch/socket-protocol/spec.md`

**Blocked by:** 01 (Split the socket-events file by concept)

**Status:** ready-for-agent

- [ ] Type-level assertions in shared types, compiled by the workspace typecheck and written first: a wrong payload for an event is an error (`@ts-expect-error`); an acknowledgement resolves to its event's type; the players room's `STATE_SYNC` is `PlayersStatePayload`, not the admin or display view; and `TEAM_KICKED` takes no payload.
- [ ] The frontend emit helper has no `event: string, payload: unknown` signature left, and no role hook passes a type argument to it by hand.
- [ ] No frontend listener for a protocol event declares its payload type by hand; the phone's state listeners receive the players view.
- [ ] The role-hook tests on the fake socket (connection core, player game, admin game, display game, team join on a real `usePlayerGame`) pass, changed only in their typings.
- [ ] `DOCUMENTATION.md` and `CODING_STANDARDS.md` are updated as above.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass across all workspaces.
