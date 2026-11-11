# 02: A team picks its side

**What to build:** In a session played with Versus, every team is on a **Side**. A team picks its side on its phone when it joins and can switch until the quiz starts. The quiz master sees each team's side on the `/control` roster, and can't start the quiz while a team has no side (see the [spec](../spec.md)).

- **Storage:** a nullable side id on the team's roster row for the session, with one MikroORM migration. It's read into session state's roster entries when the session is placed and as teams join, following the jokers cache. Kicking a team or a team leaving deletes the row, so the side goes with it.
- **Phone event:** pick or switch the team's own side through the Session write; it doesn't touch scores. Allowed in the lobby, and at any status while the team has no side (a late join). Refused once the quiz has started and the team has a side, and refused for an unknown side id. Added to the socket-event authorization declarations.
- **Phone:** while Versus is on and the team has no side, the phone shows a side picker before anything else. The picker covers that phone only and is not a status. Reuse the joker pick screen's pattern. In the lobby the team can reopen it to switch. The phone header shows a side badge (name and colour) next to the team name.
- **Settings that depend on picks:**
  - Turning Versus off clears every team's side in the same write.
  - Turning Versus on in the lobby makes side-less phones show the picker.
  - Removing a side that a roster team is on is refused. If the schema can't see the roster, this refusal lives in the settings write.
- **Start quiz:** refused while Versus is on and any roster team has no side, shown on `/control` like other refused presses.
- **`/control` roster:** shows each team's side (colour and name).
- **Docs:** `DOCUMENTATION.md` (the event, the refusals and the roster side in the views). The `/guide` text goes in ticket 07.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A team picks a side in the lobby and can switch; the side appears in the players view and the admin roster (gateway spec, following `set-player-count.spec`)
- [ ] After Start quiz a switch is refused; a team joining late with no side can pick once
- [ ] An unknown side id is refused; the event is in the authorization spec
- [ ] Start quiz is refused while a team has no side, and allowed once all have one
- [ ] Turning Versus off clears picks; removing a side with teams is refused; turning Versus on prompts side-less teams
- [ ] A kicked team's side is gone; if it rejoins, it picks again
- [ ] Reconnecting keeps the team's side
- [ ] Phone: the picker shows when side-less, the badge shows the side (play component tests)
- [ ] `/control` roster shows each team's side
- [ ] Migration created and applied; `DOCUMENTATION.md` updated
