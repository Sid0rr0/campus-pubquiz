# 03: Topic suggestions across sessions

**What to build:** The trends response gains `topics`: every topic suggestion from the range, grouped with the session detail's existing grouping function (moved somewhere both can import it, not copied), sorted by count, then alphabetically. The page shows them as "Geography ×4".

Parent spec: `.scratch/feedback-trends/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Real-Postgres test: the same topic from different sessions merges; most common spelling wins
- [x] The session detail still uses the same grouping (its tests stay green)
- [x] Page list and empty state
- [x] `DOCUMENTATION.md` updated
