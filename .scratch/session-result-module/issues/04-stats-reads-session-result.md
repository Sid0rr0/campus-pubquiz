# 04: Stats session detail reads the Session result, and closest_guess has no correct rate

**What to build:** On a night's stats page (`/stats/:id`), a closest_guess question is never named the hardest, easiest, all-correct or none-correct question. Its correct-rate cell shows "—", but its answered and correct counts are still listed. A round's correct rate and the hardest round leave closest_guess questions out; a round made up only of closest_guess questions has no rate and can't be the hardest. The standings table takes placing, left, totals, correct count and the trophy row (the session winner) from the Session result, and the questions table takes its counts and rate from it.

Parent spec: `.scratch/session-result-module/spec.md`

**Blocked by:** 02 (can run in parallel with 03)

**Status:** done

- [ ] The stats session detail calc reads per-team and per-question figures from the Session result. Response times, the bonus summary, feedback and ratings stay in the stats calc.
- [ ] The trophy row is still the single session winner (`isSessionWinner`), never every team tied for first.
- [ ] The session detail's question row and round row correct rates become nullable in shared types. They are null for closest_guess, and for a round with no rated question.
- [ ] The hardest, easiest, all-correct and none-correct question highlights and the hardest round consider only rows that have a rate.
- [ ] The stats page shows "—" for a null correct rate in the questions and rounds tables, with a frontend spec covering it.
- [ ] The existing session detail calc spec gains these cases, and fixtures that assumed the old behaviour are updated, not deleted:
  - a closest_guess question that would otherwise be hardest is never a highlight;
  - its rate is null;
  - round rates leave it out.
- [ ] Docs, in the same change: DOCUMENTATION.md's correct-rate paragraph and highlights say closest_guess has no rate, and the round correct rate leaves it out.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once before the PR, since the stats and team page smoke checks open these screens.
