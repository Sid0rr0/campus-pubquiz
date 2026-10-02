# 03: Team joined, kicked or left goes through the session write

**What to build:** When teams join, leave or get kicked while other things are happening, the roster, the connection dots and the leaderboard stay consistent, and a removed team never comes back. Today team connected and team removed each fetch standings and then apply them with the roster, so an overlapping event can put an older roster or leaderboard back.

Team connected and team removed (kick and leave) become session writes. The roster and connection change happen inside the write, and standings come from its last step. The TEAM_KICKED notice is still worked out from the socket the team held when its removal ran.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Written first, failing against today's code: a kick, then a different team's join, with the kick's standings read held. The final admin snapshot has the joined team connected and on the leaderboard at zero, and doesn't have the kicked team in either.
- [x] A team joining while a bonus write is held appears connected once both finish.
- [x] A kicked team that still had a socket gets TEAM_KICKED exactly once.
- [x] The team-removed, join-players, team-presence and connection specs pass unchanged.

## Comments

Implemented in the commit `feat(backend): team joined, kicked or left go through the session write` (see git history for the hash). `teamConnected` and `teamRemoved` are session writes. They take a roster loader instead of a roster, so the roster is read inside the write and a join queued behind a kick can't put a removed team back. TEAM_KICKED goes to the socket the team held when the write ran, and the kick handler now closes that same socket. Only the kick-then-join spec failed against the old code; the held-bonus join and TEAM_KICKED-once specs already held and are kept as guards. Known gap, unchanged by this ticket: `TeamService.join` runs before the write, so a join racing a kick of the same team can still mark the removed team connected.
