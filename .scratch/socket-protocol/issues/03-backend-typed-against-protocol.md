# 03: The backend typed against the protocol

**What to build:** The backend sends and receives socket events through the same protocol map the frontend uses, so a payload mismatch on the server is a compile error too.

- **Typed servers and sockets.** The gateway's `socket.io` server and sockets are typed by the protocol's event maps.
- **Room views typed by room.** The one state broadcast and the connection's sync step each send `StateViewByRoom[R]` to room `R`, so the admin view can't be sent to the players room, and the resync path is checked the same way as the live path.
- **Typed replies and notices.** `SocketReply` and `SocketNotice` from the Live session module become unions over the server-to-client events they may send, each pairing an event with its payload type, and outcome delivery emits them through the typed server. Session closed and the connection's `exception` message go through the typed server as well.
- **Declarations keyed by protocol event.** Each socket event declaration's `event` is a key of the client-to-server map. A compile-time check beside the declarations asserts that each declaration's Zod schema output is assignable to that event's protocol payload. The schemas stay the runtime boundary validation; the check keeps them in step with the type both ends use.

No behaviour changes: event names, rooms, authorisation, delivery order, the session write and reconnection stay as they are.

Parent spec: `.scratch/socket-protocol/spec.md`

**Blocked by:** 02 (The protocol map, and the frontend typed against it)

**Status:** ready-for-agent

- [ ] Written first: a compile-time assertion fails when a declaration's schema gains or loses a field its protocol payload doesn't have (shown with `@ts-expect-error` on a deliberately mismatched schema).
- [ ] `SocketReply` and `SocketNotice` no longer carry `event: string, payload: unknown`; an outcome built with a mismatched event and payload doesn't compile.
- [ ] The state broadcast and connection sync are typed by room; the gateway's server is typed by the protocol.
- [ ] The existing gateway specs pass unchanged, apart from typings: socket payload validation, event authorisation, outcome delivery order, screen projection delivery, room scoping, connection, team answers sync and notify session closed.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass across all workspaces.
