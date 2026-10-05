# 04: Leave and kick are module events

**What to build:** When a team leaves the session or is kicked, the Live session module handles it as one event:

- **Leave** takes the sender's socket and checks it owns the team's seat.
- **Kick** is admin-only, so it has no ownership check. Its outcome carries the kicked notice and the team's socket to close.

Each removes the team from the roster, lists the roster itself and runs the existing team-removed refresh. Both handlers become one-line adapters.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** done

- [x] Leaving from a socket that doesn't own the seat is refused with "Can only leave the session as your own team".
- [x] A team that leaves or is kicked disappears from the roster and leaderboard in the next view.
- [x] A kicked team gets the kicked notice, then its socket closes.
- [x] Kicking a disconnected team still removes it, with no notice and nothing to close.

## Comments

Implemented in the commit `refactor(backend): leave and kick are Live session module events` (find it in git history; no hash recorded here).

- `GameStateService.teamLeft(joinCode, teamId, socketId)` refuses a socket that doesn't own the seat ("Can only leave the session as your own team"); `kickTeam(joinCode, teamId)` has no ownership check. Both go through a private `teamRemoved` that removes the roster row, then lists the roster inside the session write. `GameStateService` now takes `TeamService` as a constructor dependency. `leave-session.handler.ts` and `kick-team.handler.ts` are one-line adapters.
- Already pinned by `team-removed.spec.ts`, `session-write.spec.ts` and `outcome-delivery-order.spec.ts`; added the missing "no kicked notice for a disconnected team" assertion first.
- `getConnectedSocketId` is still used by the join handler, so it stays until tickets 05 and 08.
