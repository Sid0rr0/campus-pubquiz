# 01: Half points are exactly half

**What to build:** On `/control`, the quiz master's **Half** button awards exactly half a question's points. Half of a 1-point question is 0.5 (label "Half (0.5)"), half of 3 is 1.5, and half of 4 is still 2. A half grade counts as partial, and only the pressed grade button shows the ✓, so Half and Full never look the same. An "all or nothing" match question with exactly one wrong pair also awards exactly half, because it follows the same **half points** rule (see `CONTEXT.md`). Saved scores from past sessions are left as they are. Spec: `.scratch/half-points/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The Scoring module's half-points rule returns exactly half with no rounding (1 → 0.5, 3 → 1.5, 4 → 2, 0 → 0); the existing test asserting half of 1 is 1 is updated
- [x] A manual grade of 0.5 on a 1-point question gets the verdict partial (scoring test)
- [x] An "all or nothing" match with one wrong pair scores 0.5 on a 1-point question and 1.5 on a 3-point question, verdict partial (scoring test)
- [x] Answers panel: the Half label shows the exact amount (1 → "Half (0.5)", 3 → "Half (1.5)", 5 → "Half (2.5)"); the existing label table is updated
- [x] Answers panel: on a 1-point question, pressing Half sends 0.5, and once the answer is graded 0.5 only Half shows the ✓ (Full doesn't)
- [x] The custom grade box is unchanged (still accepts any non-negative amount)
- [x] `DOCUMENTATION.md`: the grading step (0 / half / full) and the "all or nothing" match rule ("half (rounded)") say exactly half; the `/guide` page is updated if it states the Half amount
- [x] Typecheck, lint and the shared-types and frontend test suites pass

## Comments

Implemented in `fix(shared-types,frontend): half points are exactly half`. Status set to `done`. `.scratch/overview.md` has no rows for this feature, so it is unchanged.

- `halfPoints` now returns `points / 2`. The Half button label, the amount it sends and the ✓ all follow from it, so `answers-panel.tsx` needed no change. The `/guide` page doesn't state the Half amount.
- Tests: updated `scoring.test.ts` (half rule, all-or-nothing 1 → 0.5 and 3 → 1.5, manual 0.5 on 1 point is partial) and `answers-panel.test.tsx` (labels, Half sends 0.5, only Half is checked at 0.5). I also updated an `auto-grading.spec.ts` assertion that encoded the old rounding (5 points → 2.5).
- Known gap, ticket 02's scope: kahoot speed scoring still wraps points in `Math.round`, so a half-credit match answered under kahoot rounds back to 0 or full.
- One backend full-suite run had a single failing test that passed on rerun; I didn't identify it.
