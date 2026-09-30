# 03: Teams table renders server standings; roster changes refresh them

**What to build:** A team appears on the leaderboard at zero points the moment it joins, and a kicked or departed team disappears from it at once. Standings are refreshed whenever the roster changes, through whatever refresh path exists when this lands (see the Live session module spec). The control panel's teams table (and `/remote`'s, if it shares it) stops merging teams into the leaderboard, zero-filling and re-sorting. It renders the snapshot's leaderboard in the order given, with rank labels ("1.", "2.–4.") built from `rank`/`rankTo`. What the quiz master sees matches the big screen exactly. See [spec](../spec.md).

**Blocked by:** 02 (Live leaderboard served by the Standings service)

**Status:** ready-for-agent

- [x] Backend test: after a team joins, the pushed leaderboard includes it at zero with the right shared rank.
- [x] Backend test: after a team is kicked, and after a team leaves, the pushed leaderboard no longer includes it and the remaining ranks close up.
- [x] The teams table has no client-side merge, zero-fill or sort. Its tests feed pre-ranked entries and assert the rendered order and labels, including a tie.
- [x] Tied teams appear in the same order in the teams table and on `/display`.

## Comments

Implemented in the commit titled `feat(backend,frontend): teams table renders server standings` (hash in git history). `GameStateService.teamConnected` is now async and refreshes the leaderboard (a joined team appears at zero at once); kick/leave already refreshed it through `teamRemoved`. `TeamsTable` lost its `teams` prop, merge, zero-fill and sort and renders `leaderboard` as given, labelled by new `formatRankLabel` (`app/lib/rank-label.ts`). `/remote` does not use this table. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
