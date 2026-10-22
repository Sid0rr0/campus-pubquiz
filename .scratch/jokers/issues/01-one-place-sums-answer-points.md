# 01: Prefactor: one place adds up answer points

**What to build:** Every figure built from answers' points goes through one shared step, so ticket 06 can add the joker doubling there and nowhere else (ADR 0004). Standings builds a team's quiz points from its per-round points instead of a second, separate sum. The scoresheet, the session detail and the team history read a cell's points through one shared function rather than reading each answer's points directly. Nothing the quiz master, the teams or the stats pages see changes.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Standings' totals equal the sum of its round points, produced by one step; the separate total-points sum is gone
- [ ] The Session result, the league table, the scoresheet, the session detail and the team history all get their answer points through the shared step or function
- [ ] Every existing standings, session result, league, stats and team-page spec passes unchanged
