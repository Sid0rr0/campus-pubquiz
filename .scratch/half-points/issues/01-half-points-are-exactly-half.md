# 01: Half points are exactly half

**What to build:** On `/control`, the quiz master's **Half** button awards exactly half a question's points. Half of a 1-point question is 0.5 (label "Half (0.5)"), half of 3 is 1.5, and half of 4 is still 2. A half grade counts as partial, and only the pressed grade button shows the ✓, so Half and Full never look the same. An "all or nothing" match question with exactly one wrong pair also awards exactly half, because it follows the same **half points** rule (see `CONTEXT.md`). Saved scores from past sessions are left as they are. Spec: `.scratch/half-points/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Scoring module's half-points rule returns exactly half with no rounding (1 → 0.5, 3 → 1.5, 4 → 2, 0 → 0); the existing test asserting half of 1 is 1 is updated
- [ ] A manual grade of 0.5 on a 1-point question gets the verdict partial (scoring test)
- [ ] An "all or nothing" match with one wrong pair scores 0.5 on a 1-point question and 1.5 on a 3-point question, verdict partial (scoring test)
- [ ] Answers panel: the Half label shows the exact amount (1 → "Half (0.5)", 3 → "Half (1.5)", 5 → "Half (2.5)"); the existing label table is updated
- [ ] Answers panel: on a 1-point question, pressing Half sends 0.5, and once the answer is graded 0.5 only Half shows the ✓ (Full doesn't)
- [ ] The custom grade box is unchanged (still accepts any non-negative amount)
- [ ] `DOCUMENTATION.md`: the grading step (0 / half / full) and the "all or nothing" match rule ("half (rounded)") say exactly half; the `/guide` page is updated if it states the Half amount
- [ ] Typecheck, lint and the shared-types and frontend test suites pass
