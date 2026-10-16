# 01: Admins manage leagues and their ended sessions

**What to build:** The `leagues` and `league_sessions` tables with a migration. Admin-only REST to create, update and delete a league and to add or remove an ended session. A staff read listing leagues with their sessions, with a `current` filter. The `/leagues` admin page: list, create/edit, and per league its sessions with remove and "Add a session" (ended sessions not yet in it).

Parent spec: `.scratch/league/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Real-Postgres tests: add and remove an ended session; adding a live session via this route is refused; delete cascades only league rows; `current` uses `endsOn ≥ today`
- [ ] Zod validation (`endsOn ≥ startsOn`, non-empty name); moderator writes → 403
- [ ] Admin page with empty states
- [ ] `DOCUMENTATION.md` gains a League section; `GLOSSARY.md` already has the terms
