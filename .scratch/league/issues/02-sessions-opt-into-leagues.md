# 02: Sessions opt into leagues when created or in settings

**What to build:** `CreateSessionPayload` and the session settings patch gain `leagueIds: number[]`, Zod-validated, with every id an existing current league (a league the session is already in may stay). Writes replace the session's set and are refused once the session has ended. The session-create form and the `/control` session settings panel show checkboxes for current leagues, plus any the session is already in. Open to admin and moderator.

Parent spec: `.scratch/league/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Real-Postgres test: create with leagues, patch to change them, unknown or non-current id → 400, patch after end refused
- [ ] Moderator can tick leagues
- [ ] Form and settings-panel checkboxes, including "no current leagues" (section hidden)
- [ ] `DOCUMENTATION.md` (Sessions) and the `/guide` page updated
