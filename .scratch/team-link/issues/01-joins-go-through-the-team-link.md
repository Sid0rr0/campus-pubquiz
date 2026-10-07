# 01: Joins go through the Team link

**What to build:** A team's phone sends exactly one join whenever one is needed, and never a second one by accident. That covers:

- **The first join:** one join per connection, even when the team taps Join twice.
- **A refused join:** the reason shows on the join screen, the next tap retries over a fresh connection, and the error clears once a later join is accepted.
- **A refused connection** (an unknown game code): the error shows and the next tap is let through.
- **A reconnect:** the phone rejoins its team on the new connection, naming the earlier socket so the server hands the team over (no handover when the socket is the same).
- **A session restart:** the phone rejoins through the same path as every other join. A refresh that lands on the lobby sends only one join.

Every join uses the same payload rule: the stored team token, the typed team code (else the stored one), the game code and the handover socket id. The URL's game code, team code and name win over what the phone stored; storage fills only what the URL left empty.

This ticket introduces the **Team link** module: plain TypeScript, no React, no socket. Its interface is an initial state built from the URL and the stored identity, and a reducer that takes events and intents and returns the new state plus commands. In this ticket the events are the connection's connected, disconnected and refused, join accepted and refused, and the players view's status. The intents are the form fields and join submit. The commands are opening a connection for a game code and attempt, sending a join, and writing the stored identity.

A `useTeamLink` hook adapter replaces the join hook for `/play` and the home page's join panel, with the same result shape the pages read today minus the raw join function. It reads `localStorage` once after mount, feeds socket events and taps into the module, and carries out its commands. It still sits on top of the existing player hook for answers and the team's data; ticket 03 folds that in.

The module is the only thing that decides to send a join. The `/play` page's own restart join, which skips the double-tap guard, the once-per-connection dedupe and the typed team code, is removed.

`GLOSSARY.md` gains **Team link**: a phone's link to its team in a live session (who the team is, whether the server has this connection registered as the team's, and the team's own answers, grades, bonus awards and ratings). It's made by a join, remade after every reconnect and after a session restart, and ended by a kick, the session closing or logging out.

Parent spec: `.scratch/team-link/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Module event-sequence tests (no React, no socket, no timers), written first:
  - identity known and connection connected arriving in either order → one join command;
  - a second submit while a join is in flight → no command;
  - join refused → error in state, guard released, next submit opens a fresh connection and sends a join;
  - a later accepted join clears the error;
  - connection refused → guard released;
  - reconnect → one join with the earlier socket id, none when it's the same socket;
  - status moves into `lobby` from another status on the same connection → one join;
  - the first status seen on a connection being `lobby` → no extra join;
  - URL-versus-storage precedence;
  - the assigned team code shows up in the form after a join without one.
- [x] Adapter tests on the fake socket: one end-to-end join, connect and accept, with the emitted join payload and the stored token and team code written.
- [x] The `/play` page no longer sends a join itself; the page's restart and refresh-on-lobby tests move to module tests, and its rendering tests pass.
- [x] The real-socket join test that fails about one run in five is removed; its double-join case is a module test. The adapter and module test files pass ten runs in a row.
- [x] `GLOSSARY.md` has the **Team link** entry.
- [x] `pnpm --filter frontend test`, `pnpm lint` and `pnpm typecheck` pass.
