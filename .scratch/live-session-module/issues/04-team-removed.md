# 04: Team removed (kick / leave)

**What to build:** Kicking a team and a team leaving the session become one Live session "remove team" operation. It refreshes the roster and the leaderboard together, so a removed team disappears from both in the same snapshot. The kicked-team notice to the team's socket travels in the outcome. See the spec's user stories 2, 3 and 30 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Regression test (real-store harness): a team that has scored points is kicked, and the next snapshot's leaderboard and roster both no longer contain it.
- [x] The same for a team that leaves the session itself.
- [x] The kicked team's socket still receives TEAM_KICKED and is disconnected. A disconnected team can still be kicked.
- [x] Leaving as another team is still rejected with today's message.

## Comments

Implemented in commit `HASH`. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state, and `.scratch/overview.md` records completion.

- `GameStateService.teamRemoved(joinCode, teamId, roster, 'kicked' | 'left')` drops the connection, sets the roster and recomputes the leaderboard together, and returns an outcome; a kick carries the `TEAM_KICKED` notice for the team's socket.
- The kick handler disconnects the socket after delivery, so the notice is out before it closes. The notice now goes through `server.to(socketId)` (the shared delivery step) instead of a direct `socket.emit`; the fake-harness kick spec was adjusted, and a payload-less notice is emitted with no argument as before.
- `setTeams` stays public for the join handler until ticket 07.
