# 08: The leaderboard 2× stamp

**What to build:** On the first leaderboard after the block holding a team's joker round, the team's row gets a "2×" joker stamp as its rank is revealed on the big screen, with its gained points visibly doubling, and the same stamp on that team's own phone leaderboard. It shows on 0 points too. In a kahoot joker round it shows after each of that round's questions. The server decides which rows get it.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The leaderboard description (built from the Prior standings) carries a per-row flag: the team's joker round has a question in the block just scored
- [ ] The big screen stamps the row when its rank is revealed; the phone stamps the team's own row; no replay on reload
- [ ] Shown on 0 points; per question in a kahoot joker round; not on later blocks' leaderboards
- [ ] Real-store harness specs for the flag; page specs for both screens
- [ ] `DOCUMENTATION.md` and `/guide` updated
