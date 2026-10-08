# 06: Team roster change module

**What to build:** A team joining or rejoining, a socket dropping, a team leaving, and the quiz master kicking a team behave exactly as today. The team roster change module now builds all four, following the pattern from ticket 01.

**Join.** The module owns the join change:

- It resolves the team through the team service inside the write.
- It applies the seat takeover rule. A live socket already holding the seat refuses the join, unless the request names that socket as its previous one; then that socket is listed to close. The "is this socket live" check is passed in by the socket layer as an argument.
- It records the connection and the roster together.

The module also exposes the join reply builder: saved answers, bonus awards, round ratings and feedback for the team. The façade calls it after the join's write, as today. The façade keeps the join's "any failure becomes a refusal" wrapping exactly as it is.

**Disconnect.** A socket that held no team still produces nothing to push. The façade's write for it skips the standings read.

**Leave and kick.** Leave still refuses unless the socket owns the team's seat. Leave and kick share the team-removal change, which is private to the module. It removes the team from the roster, drops its connection, and swaps in the roster after the removal. A kick also carries TEAM_KICKED to the socket the team held, then closes that socket.

The module takes the team service, plus the answer, bonus and feedback services for the join reply.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] Join, disconnect, leave and kick are built by the team roster change module. Each façade method is a single `write` call. The join also builds its reply and wraps refusals, as today.
- [ ] The seat takeover rule and the team-removal change live only in this module.
- [ ] Refusal messages are unchanged word for word, including the "already connected on another device" message.
- [ ] The module imports neither the Session write module nor the game state class.
- [ ] Every existing backend spec passes without edits, in particular:
  - join-players, join-leave-kick-order, team-removed, team-presence, team-connection-presence, disconnect-user, notify-session-closed,
  - the session-write spec's roster and disconnect cases.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
