# 05: Pacing and Felt difficulty on feedback trends

**What to build:** Add `pacing` and `feltDifficulty` counts to each `FeedbackTrendsSession`, and add **Pacing** and **Felt difficulty** columns to the `/stats/feedback` sessions table ("2 · 7 · 1" in scale order, "—" when nobody answered). The date-range and league filters apply unchanged.

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Backend (real Postgres): counts per session, both filters respected, feedback-off sessions still left out, no team data
- [x] Frontend: the two columns and "—"
- [x] `DOCUMENTATION.md` (Feedback trends) updated
