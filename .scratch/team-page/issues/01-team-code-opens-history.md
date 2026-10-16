# 01: The team code opens the team's history

**What to build:** `POST /team-page` `{ teamCode }`, public, throttled and Zod-validated, returning the team's name and the history `TeamHistoryService` builds for staff (summary plus ended sessions with placing, points and "left" rows), minus staff-only fields. A generic 404 for an unknown code. The `/team` page has a code form and shows the history; a phone with a stored team code opens it directly.

Parent spec: `.scratch/team-page/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Real-Postgres test: figures equal the staff endpoint's for the same team; unknown code → 404
- [ ] Throttle applied (test or explicit decorator check)
- [ ] The code never appears in a URL or query string
- [ ] Page: form, stored-code path, history, empty state, error state
- [ ] `DOCUMENTATION.md` (Team stats / Authentication) documents the public endpoint
