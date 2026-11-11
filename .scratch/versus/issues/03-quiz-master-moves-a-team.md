# 03: Quiz master moves a team to another side

**What to build:** The quiz master can move any roster team to another **Side** from the `/control` roster, at any point in the session, to fix a team that tapped the wrong side (see the [spec](../spec.md)).

- **Admin event:** set a roster team's side through the Session write; it doesn't touch scores. Allowed at any status. Refused for an unknown side id or a team not on the roster. Added to the socket-event authorization declarations (admin only).
- **`/control`:** a move control on each roster row, shown only while Versus is on.
- **Docs:** `DOCUMENTATION.md` (the event). The `/guide` text goes in ticket 07.

**Blocked by:** 02

**Status:** done

- [ ] The quiz master moves a team in the lobby and mid-quiz; the players view and admin roster show the new side (gateway spec, following `set-team-player-count.spec`)
- [ ] An unknown side or a team not on the roster is refused; a players-room socket can't send the event (authorization spec)
- [ ] The move control appears only with Versus on and sends the chosen side (control component test)
- [ ] `DOCUMENTATION.md` updated
