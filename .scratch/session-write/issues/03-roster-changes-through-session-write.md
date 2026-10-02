# 03: Team joined, kicked or left goes through the session write

**What to build:** When teams join, leave or get kicked while other things are happening, the roster, the connection dots and the leaderboard stay consistent, and a removed team never comes back. Today team connected and team removed each fetch standings and then apply them with the roster, so an overlapping event can put an older roster or leaderboard back.

Team connected and team removed (kick and leave) become session writes. The roster and connection change happen inside the write, and standings come from its last step. The TEAM_KICKED notice is still worked out from the socket the team held when its removal ran.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a kick, then a different team's join, with the kick's standings read held. The final admin snapshot has the joined team connected and on the leaderboard at zero, and doesn't have the kicked team in either.
- [ ] A team joining while a bonus write is held appears connected once both finish.
- [ ] A kicked team that still had a socket gets TEAM_KICKED exactly once.
- [ ] The team-removed, join-players, team-presence and connection specs pass unchanged.
