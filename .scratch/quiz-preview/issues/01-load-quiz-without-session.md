# 01: Load a quiz's seeded rounds without a session

Status: done

Spec: [Quiz preview](../spec.md)

**What to build:** A prefactor with no change in behaviour. Loading a quiz's seeded rounds (the same Question record conversion, round order, notes and settings defaults a session's seeded game uses) no longer needs a `game_sessions` row. Session loading reuses the new session-free load and adds only what comes from the session row (its id, join code and stored settings), so a quiz preview and a session can never hold the quiz differently.

**Blocked by:** None (can start immediately).

- [ ] A quiz's seeded rounds can be loaded by quiz id alone, with no session row and no writes.
- [ ] Loading a session's seeded game goes through that load; nothing else about a session's seeded game changes.
- [ ] A test loads a quiz with several rounds, question types, media, clip bounds and notes without a session, and gets the same rounds a session on that quiz holds.
- [ ] Existing session, restart-restore and live-edit specs stay green.
