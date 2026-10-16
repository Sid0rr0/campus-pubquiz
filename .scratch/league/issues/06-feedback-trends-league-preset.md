# 06: A league preset on feedback trends

**What to build:** The feedback trends endpoint accepts an optional `leagueId`, meaning that league's ended member sessions (it wins over `from`/`to`). The `/stats/feedback` filter gains a league picker.

Parent spec: `.scratch/league/spec.md`

**Blocked by:** 01, feedback-trends 01

**Status:** ready-for-agent

- [ ] Real-Postgres test: only member sessions; an unknown `leagueId` → 404
- [ ] Filter UI switches between a date range and a league
- [ ] `DOCUMENTATION.md` updated
