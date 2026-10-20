# 01: Feedback trends endpoint and ratings over time

**What to build:** `GET /stats/feedback-trends?from=&to=` returning `sessions` (each ended session in range with `rating: { average, count } | null`, skipping sessions with feedback off), and the `/stats/feedback` page with the date filter and the sessions table, linked from `/stats`.

Parent spec: `.scratch/feedback-trends/spec.md`

**Blocked by:** —

**Status:** done

- [x] Real-Postgres test: per-session averages and counts, range filter, feedback-off sessions skipped, ended sessions only
- [x] Query params validated (bad dates → 400)
- [x] Page: filter, table, empty state
- [x] `DOCUMENTATION.md` (Session Stats) documents the endpoint
