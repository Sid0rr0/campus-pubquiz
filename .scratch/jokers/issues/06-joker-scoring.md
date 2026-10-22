# 06: Joker scoring

**What to build:** A team's points from its answers to its joker round count double everywhere scores count: the leaderboard, placing and showdown ties, the `/control` round score table, the scoresheet, the Session result, the team page and the league table. Bonus awards never double. Hand grades, key fixes and joker changes all flow straight into the doubled totals, since answers' stored points are never doubled (ADR 0004). The `/control` score table and the scoresheet mark a team's joker round cells.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] The shared step from ticket 01 doubles the joker round's answer points for the team; nothing else sums answer points
- [ ] Partial and closest-guess points double after grading; bonus awards don't; stored answer points are unchanged
- [ ] A joker change, a hand grade and a key fix each move the totals
- [ ] Correct rate, the Question outcome, the existing fun facts and the session's max points are unchanged
- [ ] Ties (and so showdowns) use the doubled totals; the showdown guess itself is never doubled
- [ ] Joker flag on the `/control` round cell and the scoresheet cell; both draw a joker mark
- [ ] Standings / Session result / league specs over real Postgres, a real-store harness spec for live totals, page specs for the marks
- [ ] `DOCUMENTATION.md` (standings, scoresheet) and `/guide` (the score table mark) updated
