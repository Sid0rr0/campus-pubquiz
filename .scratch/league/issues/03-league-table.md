# 03: League points, the league table and the public page

**What to build:** A pure module computing league points and the league table from per-session placings (from the Standings module) and "answered at least once" flags, with the spec's scale, participation rule and tie-breaks. Public `GET /leagues/public` and `GET /leagues/:id/table`. The public `/league` page lists current leagues first and shows the selected league's table.

Parent spec: `.scratch/league/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Unit tests: scale, shared places, left team → participation only, zero answers → nothing, each tie-break step, empty league
- [x] Real-Postgres test: only ended member sessions count; a session in two leagues counts in both; the response carries no codes or feedback
- [x] Public page with an empty state
- [x] `DOCUMENTATION.md` documents the endpoints and the scoring
