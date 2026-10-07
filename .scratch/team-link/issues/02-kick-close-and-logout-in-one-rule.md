# 02: Kick, session close and logout use one rule in the Team link

**What to build:** However a team's link to its session ends, the phone ends up in a known state:

- **Kicked by the quiz master:** the phone lands on the join screen with "You were removed from this team by the quiz master" and an empty form. All stored identity is cleared, so a reload doesn't silently rejoin. This also holds when the page mounts already kicked.
- **Session closed by the quiz master:** the phone returns to a fresh join screen with the team name and team code still filled in. The session part of storage (team token and game code) is cleared.
- **Logging out:** the server is told the team is leaving while the socket is still connected, but only when there's a confirmed team. The session part of storage is cleared, the name and team code stay in the form, and the game code goes back to the URL's.

All three release the join guard and clear the join error, so the next join tap always goes through. Each also means a stored team name with no game code shows the join form, never a "Connecting…" screen that doesn't end.

Today the three paths each reset a slightly different subset by hand (an effect for kick, a render-time adjustment for session close, a callback for logout). They become one rule in the Team link module: kicked and session closed are events, logout is an intent, and the commands are send a leave, clear the session part of stored identity, clear all of it, and go to the join screen. The adapter carries them out against the socket, `localStorage` and the router. The banner's error stays "join error, else kick notice, else connection error".

Parent spec: `.scratch/team-link/spec.md`

**Blocked by:** 01 (Joins go through the Team link)

**Status:** ready-for-agent

- [ ] Module event-sequence tests, written first:
  - kicked (live, while a join is in flight, and as the starting state) → clear all storage, empty form, kick notice, go to the join screen, no further join;
  - session closed → clear session storage, keep name and team code, go to the join screen;
  - logout with a team → leave command before the storage clear;
  - logout with no confirmed team → no leave;
  - after each, the next submit is let through.
- [ ] Adapter tests on the fake socket: a kick clears `localStorage` and navigates; logout emits a leave with the team's id.
- [ ] The `/play` kick, session-close and logout page tests pass, with lifecycle-ordering assertions moved to module tests and the rendering ones kept.
- [ ] `pnpm --filter frontend test`, `pnpm lint` and `pnpm typecheck` pass.
