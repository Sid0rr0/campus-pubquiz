# 06: Session rating, pacing and felt difficulty in the night brief

**What to build:** Add the session rating (average and count, or "no ratings") and the Pacing and Felt difficulty counts to the brief's session-level lines in `session-brief.calc.ts`. With feedback off, the existing "Feedback was off." covers them. No per-round response time.

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Calc tests: the lines with answers, with none, and with feedback off
- [x] `DOCUMENTATION.md` (Night brief) updated

Note: the scale counts are computed in the brief calc from the feedback input rows (new optional `pacing` / `feltDifficulty` on `SessionDetailFeedbackInputRow`, selected by `StatsService`), not read from the detail, so it does not depend on ticket 03's detail shape.
