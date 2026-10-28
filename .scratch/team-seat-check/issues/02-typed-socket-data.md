# 02: Per-connection socket data is typed

**What to build:** Nothing changes for teams, staff or the big screen. Under the hood, the per-connection data the socket layer keeps on each socket is declared once, so it is read and written without hand-written casts and a misspelt field fails to compile instead of reading `undefined` on quiz night, as the [spec](../spec.md) describes.

- **The shape:** the signed-in user, the session's join code and the refused-join count, all optional, declared once in the socket types.
- **Wiring:** passed as Socket.IO's socket-data type parameter to the game server and game socket types, so every socket the gateway, connection handling, guarded dispatch and session broadcaster touch carries it.
- **Every cast goes:** the six sites that cast a socket's data to read or write one of these fields use the declared type instead.
- Client-side socket types are out of scope. This ticket touches backend socket types only, not the change modules from ticket 01.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No cast of a socket's data remains in the backend source
- [ ] Reading a field the shape doesn't declare is a `pnpm typecheck` error
- [ ] The existing connection, guarded dispatch and broadcaster specs pass unchanged
