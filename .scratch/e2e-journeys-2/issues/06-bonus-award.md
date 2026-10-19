# 06: Bonus award

**What to build:** A journey where the quiz master gives a bonus award in a bonus category during the break; the team's phone shows the toast and the leaderboard includes the points.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The toast shows on the awarded team's phone only.
- [x] The standings include the bonus.
- [x] Passes `--repeat-each=5`.

Journey: `e2e/tests/bonus-award.spec.ts`, helpers in `e2e/support/bonus.ts`. It reuses `fixtures/quiz-night.csv` (no new CSV or snapshots needed: no status cell is new). The quiz has one break, which is its last, so the big screen's leaderboard there is the podium.
