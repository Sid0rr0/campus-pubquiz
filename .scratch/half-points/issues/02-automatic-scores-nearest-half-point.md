# 02: Automatic scores land on the nearest half point

**What to build:** Points the app works out itself are kept to the nearest half point instead of the nearest whole point, so a part-right answer is never rounded up to full points and totals display cleanly (e.g. `2.5`). A per-pair match on a 1-point question with 1 of 2 pairs right scores 0.5; a 4-point per-pair match with 2 of 3 right scores 2.5. In a kahoot round, the speed-scaled score is also kept to the nearest half point, so a half-credit match can't be rounded back up to full points. Verdicts don't change: a per-pair match is correct only with every pair right, incorrect with none, otherwise partial; speed never changes a verdict. Spec: `.scratch/half-points/spec.md`.

**Blocked by:** 01 (Half points are exactly half)

**Status:** ready-for-agent

- [ ] The Scoring module has a "nearest half point" rule (rounds to the nearest multiple of 0.5), used by per-pair match scoring and kahoot speed scoring in place of whole-point rounding
- [ ] Per-pair match: 1 point with 1 of 2 right → 0.5; 4 points with 2 of 3 right → 2.5; all right → full points (correct); none right → 0 (incorrect) (scoring tests)
- [ ] Kahoot speed: a half-credit 1-point match ("all or nothing", one wrong pair) scores a multiple of 0.5 and never full points at any speed, verdict still partial (scoring test)
- [ ] Existing kahoot speed and match scoring tests still pass, or are updated only where whole-point rounding changes to half-point rounding
- [ ] `DOCUMENTATION.md` states the nearest-half-point rule for per-pair match and kahoot speed scoring
- [ ] Typecheck, lint and the shared-types, backend and frontend test suites pass
