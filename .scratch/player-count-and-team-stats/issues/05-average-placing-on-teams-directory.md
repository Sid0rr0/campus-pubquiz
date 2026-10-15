# 05: Avg. placing on the teams directory

**What to build:** The `/teams` directory gains a sortable Avg. placing column: the team's **average placing** across the ended sessions it played, to one decimal, with sessions it left excluded. A team with no placing shows "—" and sorts last whichever way the column is sorted.

The directory's list items gain `averagePlacing: number | null`, and its sort columns gain average placing, with `null`s last in both directions. The figure uses the same placing derivation as the team stats page, so the directory and the team page always show the same number for a team.

Parent spec: `.scratch/player-count-and-team-stats/spec.md`

**Blocked by:** 04 (Team stats page), whose placing derivation this reuses

**Status:** ready-for-agent

- [ ] Team service on real Postgres: `averagePlacing` matches the team page's average placing for the same team, leaving out left sessions and counting ties at the shared placing
- [ ] Team service: sorting by average placing works ascending and descending, with teams that have no placing last both ways
- [ ] Controller: average placing is accepted as a sort column, and an unknown sort column is still rejected
- [ ] `/teams`: the Avg. placing column renders, shows "—" for a team with no placing, and sorts when clicked
- [ ] `DOCUMENTATION.md` documents the new field and sort column
