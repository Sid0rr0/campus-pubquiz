# 03: Pacing and Felt difficulty tiles on the session stats page

**What to build:** Add **Pacing** and **Felt difficulty** tiles next to Rating on `/stats/:id`. The value is the most common answer, or "Mixed" when the top two tie. The detail lists all three counts in scale order. A tile shows "—" when nobody answered and "Feedback was off" when off. The measured Difficulty tile stays.

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Backend (real Postgres): counts per scale on the session detail, no team data
- [x] Frontend: both tiles with their value, detail, "Mixed", "—" and "Feedback was off" states
- [x] `DOCUMENTATION.md` (Session Stats) updated
