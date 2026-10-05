# Spec: Half points are exactly half

Status: ready-for-agent

## Problem Statement

On `/control`, grading an answer **Half** on a 1-point question awards 1 point, the same as **Full**. The Half button is labelled "Half (1)", both the Half and Full buttons show the ✓ once either is pressed, and the answer is recorded as correct rather than partial. Since 1 point is the default for every question, this affects most quizzes: a team the quiz master meant to give half credit ends up level with a team that got it fully right.

The same rounding up leaks in elsewhere:

- Odd-point questions round up (half of 3 is 2).
- An "all or nothing" match question with exactly one wrong pair awards rounded-up half points, so a 1-point match with one wrong pair also scores the full 1 point (recorded as partial).
- A match scored per pair rounds to whole points, so a 1-point match with 1 of 2 pairs right scores the full 1 point.
- Kahoot speed scoring rounds to whole points, so even a correct half would be pushed back up to 1 (or down to 0).

## Solution

**Half points** (see `CONTEXT.md`) mean exactly half a question's points: half of 1 is 0.5, half of 3 is 1.5. The Half button on `/control` shows and awards that exact amount, only one grade button shows the ✓, and a half grade counts as partial.

Points the app works out itself (a part-right match, a kahoot speed score) are kept to the nearest half point, so every automatic score is a whole or half point and totals display cleanly (e.g. `2.5`, never long decimals).

Answers already saved in past sessions keep the scores they have.

## User Stories

1. As a quiz master, I want the Half button on a 1-point question to award 0.5, so that a half-right answer isn't scored as fully right.
2. As a quiz master, I want the Half button on a 3-point question to award 1.5, so that "half" means half, not "half rounded up".
3. As a quiz master, I want the Half button on an even-point question to keep awarding exactly half (4 → 2), so that nothing changes where nothing was wrong.
4. As a quiz master, I want the Half button's label to show the exact amount it awards ("Half (0.5)"), so that I know what I'm giving before I press it.
5. As a quiz master, I want only the button I pressed to show the ✓, so that I can tell at a glance whether I graded an answer half or full.
6. As a quiz master, I want an answer graded half to count as partial, so that it isn't counted as a correct answer in stats or reveals.
7. As a quiz master, I want an answer graded full on a 1-point question to show the ✓ only on Full, so that the two grades never look the same.
8. As a quiz master, I want an "all or nothing" match question with exactly one wrong pair to award exactly half the question's points, so that it's consistent with the Half button.
9. As a quiz master, I want a 1-point "all or nothing" match with one wrong pair to award 0.5, so that it isn't worth the same as a fully correct match.
10. As a quiz master, I want a per-pair match score kept to the nearest half point, so that a part-right match earns a fair share without awkward decimals.
11. As a quiz master, I want a 1-point per-pair match with 1 of 2 pairs right to award 0.5, so that a half-right match isn't scored as fully right.
12. As a quiz master, I want a 4-point per-pair match with 2 of 3 pairs right to award 2.5, so that the score is the nearest half point to the true share.
13. As a quiz master, I want a per-pair match where every pair is right to still award full points, so that rounding never takes points from a perfect answer.
14. As a quiz master, I want a per-pair match where no pair is right to still award zero, so that rounding never gives points to a wrong answer.
15. As a quiz master running a kahoot round, I want speed-scaled scores kept to the nearest half point, so that a half-credit match isn't rounded back up to full points.
16. As a quiz master running a kahoot round, I want speed scaling to still never change the verdict, so that a partial answer stays partial whatever its speed.
17. As a quiz master, I want the automatic half grade of a match answer to stay overridable with the grade buttons, so that I can still adjust it in the break.
18. As a quiz master, I want a live answer-key fix to re-score match answers with the new half-point rules, so that corrected scores follow the same rules as submitted ones.
19. As a quiz master, I want the custom grade box to keep accepting any amount, so that I can still award an unusual amount on purpose.
20. As a team, I want my score on my phone to show 0.5 when I earned half a point, so that I can see I got partial credit.
21. As a team, I want the leaderboard to rank a team with 0.5 below a team with 1, so that partial credit is ranked fairly.
22. As an audience member, I want the big-screen leaderboard to show half-point totals like `2.5`, so that the scores are readable.
23. As a quiz master, I want past sessions' saved scores left as they were, so that old results and stats don't change under me.
24. As a quiz master reading the stats page, I want half-graded answers counted as partial (not correct), so that correct rates stay honest.

## Implementation Decisions

- **One rule, in the Scoring module.** The shared Scoring module's half-points function returns exactly half the question's points, with no rounding. The Half button on `/control` and the "all or nothing" match rule both already go through it, so both pick up the fix.
- **New "nearest half point" helper in the Scoring module.** It rounds an amount to the nearest multiple of 0.5. It replaces whole-point rounding in:
  - per-pair match scoring (question points × correct pairs ÷ total pairs);
  - kahoot speed scoring (base points × speed multiplier).

  Keeping every automatic score a multiple of 0.5 keeps sums exact in floating point, so leaderboard totals never show float noise.
- **Verdict rules are unchanged.** The verdict for a manual grade is already zero → incorrect, at least full → correct, anything between → partial, so a 0.5 grade on a 1-point question becomes partial with no change to that rule. Per-pair match keeps its verdicts: all pairs right → correct, no pair right → incorrect, otherwise partial (whatever the rounded points). Kahoot speed scaling still never changes the verdict.
- **No schema change.** Answer points awarded are already stored as a float; question points stay whole numbers.
- **The `/control` answers panel** keeps getting the Half amount from the shared half-points function; its label becomes "Half (0.5)" etc. Half and Full can no longer be equal for a question worth more than 0 points, so only one button ever shows the ✓.
- **Custom grade box unchanged**: it keeps accepting any non-negative amount.
- **No data migration**: answers saved before the fix keep their points and verdicts. A manual Half press stored as 1 point can't be told apart from a Full press, so recomputing isn't possible.
- **No points formatting is added.** Scores are displayed as stored; with every automatic score a whole or half point, they render as e.g. `2.5`.
- **Docs in the same commit**: `CONTEXT.md` already has the **Half points** entry. `DOCUMENTATION.md`'s grading step (0 / half / full) and match scoring rule ("half (rounded)") are updated to say exactly half, plus the nearest-half-point rule for per-pair match and kahoot speed scoring. The `/guide` page is updated if it states the Half amount.

## Testing Decisions

- Good tests here check observable outcomes: the points and verdict a submission or grade gets, and what the quiz master sees and sends from the answers panel. They don't check how the rounding is computed.
- **Seam 1: the Scoring module's public functions** (existing scoring tests in the shared types package). Update `half of 1 is 1` and `half of 3 is 2` to 0.5 and 1.5, and add cases for:
  - "all or nothing" match with one wrong pair on 1- and 3-point questions (0.5 and 1.5, partial);
  - per-pair match on a 1-point question with 1 of 2 pairs right (0.5) and a 4-point question with 2 of 3 right (2.5), plus all-right and none-right still giving full and zero;
  - kahoot speed scoring of a half-credit match landing on a multiple of 0.5 and never reaching full points;
  - the verdict for a manual grade of 0.5 on a 1-point question being partial.
- **Seam 2: the `/control` answers panel component test** (existing). Update the Half label cases (3 points → "Half (1.5)", 5 → "Half (2.5)", 1 → "Half (0.5)") and add: on a 1-point question, pressing Half sends 0.5, and once graded 0.5 only Half shows the ✓ (Full doesn't).
- No new test entry points and no backend test: the backend stores the amount and derives the verdict through the Scoring module unchanged.
- Prior art: the existing `halfPoints`, `scoreSubmission — match`, `scoreSubmission — kahoot speed` and `verdictForManualGrade` blocks in the scoring tests, and the "uses the shared half-points rule" table in the answers panel test.

## Out of Scope

- Limiting the custom grade box to whole or half points.
- Recomputing or migrating scores saved in past sessions.
- Adding number formatting for points anywhere in the UI.
- Changing closest guess grading (always full or zero).
- Allowing fractional question points in the editor or CSV import.

## Further Notes

- Found in a grilling session on 2026-10-05: the half-points function rounded half to the nearest whole point, and a test explicitly asserted that half of 1 is 1.
- Related accepted tradeoff, "Live answer-key fixes overwrite manual overrides": after a key fix, match answers are re-scored with the half-point rules and a quiz master's override is still discarded, as before.
