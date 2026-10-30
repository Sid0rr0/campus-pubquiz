# 07: Wider margin

**What to build:** on a Number question, double the margin's value in its unit for one team, or use `DEFAULT_MARGIN` (±10%) when there is none.

- Grading for that team uses the widened margin at submit time and when a key fix re-scores.
- Not offered on closest guess.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Widening rule in shared types with unit tests
- [ ] Real-Postgres spec: submit-time grade and key-fix re-score both use the team's margin
- [ ] Phone shows the team's accepted range
