# 01: Every team event checks its seat through one team-seat check

**What to build:** Teams see the same refusals, word for word, and phones still rejoin by themselves after an answer is refused as "not your team". Under the hood, every team event checks that its socket holds the team's seat through one check in the session updates module, as the [spec](../spec.md) describes, so a new team event can't pick the wrong check.

- **Seat of a socket:** the team whose seat this socket holds, or none. It replaces the find-team-by-socket helper. Disconnect uses it as is: a socket with no seat disconnects with nothing pushed.
- **Require a seat:** takes the event's refusal text and an optional claimed team id, and returns the team id the event acts for. Without a claimed team it refuses when the socket holds no seat; with one it refuses unless the socket holds that team's seat.
- **Callers:** submit answer, showdown guess and leave pass their payload's team id. Joker pick, player count, round rating and final feedback pass none. Staff events (kick, set a team's player count, grading, bonus awards) don't change.
- **Unchanged:** every refusal text (the answer's stays the shared "not your team" constant the phone's team link matches on), the check running inside the event's session write, and its order relative to each event's other refusals. Reading a team's connected socket to push to it isn't a seat check and stays as it is.
- **Docs:** one line in `CODING_STANDARDS.md` where it covers team events: a team event checks its seat through the session updates module's seat check, never by reading the connected sockets.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No change module compares or searches the connected sockets to check a seat
- [ ] The socket-event authorization, showdown socket, joker pick, set player count, rate round, rate session, send feedback and team-removed specs pass unchanged
- [ ] A gateway case, if none exists yet: an answer naming a team other than the one this socket holds the seat for is refused with the "not your team" text
- [ ] The frontend team-link seat tests pass unchanged
- [ ] `pnpm typecheck` and the backend specs pass
