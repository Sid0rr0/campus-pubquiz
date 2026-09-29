# 04: Team removed (kick / leave)

**What to build:** Kicking a team and a team leaving the session become one Live session "remove team" operation. It refreshes the roster and the leaderboard together, so a removed team disappears from both in the same snapshot. The kicked-team notice to the team's socket travels in the outcome. See the spec's user stories 2, 3 and 30 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Regression test (real-store harness): a team that has scored points is kicked, and the next snapshot's leaderboard and roster both no longer contain it.
- [ ] The same for a team that leaves the session itself.
- [ ] The kicked team's socket still receives TEAM_KICKED and is disconnected. A disconnected team can still be kicked.
- [ ] Leaving as another team is still rejected with today's message.
