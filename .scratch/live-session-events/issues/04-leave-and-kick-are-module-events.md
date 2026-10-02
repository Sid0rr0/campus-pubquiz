# 04: Leave and kick are module events

**What to build:** When a team leaves the session or is kicked, the Live session module handles it as one event:

- **Leave** takes the sender's socket and checks it owns the team's seat.
- **Kick** is admin-only, so it has no ownership check. Its outcome carries the kicked notice and the team's socket to close.

Each removes the team from the roster, lists the roster itself and runs the existing team-removed refresh. Both handlers become one-line adapters.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Leaving from a socket that doesn't own the seat is refused with "Can only leave the session as your own team".
- [ ] A team that leaves or is kicked disappears from the roster and leaderboard in the next view.
- [ ] A kicked team gets the kicked notice, then its socket closes.
- [ ] Kicking a disconnected team still removes it, with no notice and nothing to close.
