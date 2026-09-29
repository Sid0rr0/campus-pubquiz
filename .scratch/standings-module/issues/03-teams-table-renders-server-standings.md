# 03: Teams table renders server standings; roster changes refresh them

**What to build:** A team appears on the leaderboard at zero points the moment it joins, and a kicked or departed team disappears from it at once. Standings are refreshed whenever the roster changes, through whatever refresh path exists when this lands (see the Live session module spec). The control panel's teams table (and `/remote`'s, if it shares it) stops merging teams into the leaderboard, zero-filling and re-sorting. It renders the snapshot's leaderboard in the order given, with rank labels ("1.", "2.–4.") built from `rank`/`rankTo`. What the quiz master sees matches the big screen exactly. See [spec](../spec.md).

**Blocked by:** 02 (Live leaderboard served by the Standings service)

**Status:** ready-for-agent

- [ ] Backend test: after a team joins, the pushed leaderboard includes it at zero with the right shared rank.
- [ ] Backend test: after a team is kicked, and after a team leaves, the pushed leaderboard no longer includes it and the remaining ranks close up.
- [ ] The teams table has no client-side merge, zero-fill or sort. Its tests feed pre-ranked entries and assert the rendered order and labels, including a tie.
- [ ] Tied teams appear in the same order in the teams table and on `/display`.
