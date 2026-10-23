# 03: The confirm step shows what the merge will do

**What to build:** before confirming, the moderator sees:

- both teams with their sessions played
- the combined sessions played
- "Code and phones carry over from <newer team>"
- the kept team's code, so it can be read out to the team that lost it

The moderator can check the two teams really are the same before the merge, which can't be undone.

This extends 02's preview read with an optional other-team id, which returns the pair preview: both teams' sessions played, the combined sessions played, the newer team, and its code.

Parent spec: `.scratch/team-merge/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Pair preview in the team-merge module. Real-Postgres spec: the combined sessions equal what the team history shows after the merge, and the newer team and its code are the ones the merge keeps.
- [ ] Preview read accepts the optional other-team id (Zod-validated), with payload types in shared types. Controller unit spec.
- [ ] Confirm step shows both teams' sessions, the combined result, the carry-over line and the kept team's code. Vitest with mocked fetch.
