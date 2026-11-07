# 05: Pin the team narrowing of the doubled-rounds fragment

**What to build:** One mutation survivor from `pnpm mutate:changed` on PR #96 is a real gap: `ended-sessions-read.ts:344` (`doubledRounds([id], { teamId })` → `doubledRounds([id], {})`) is not caught. Nothing asserts that the team session detail marks only that team's doubled rounds when another team in the session also doubles a round.

Parent spec: `.scratch/doubled-rounds/spec.md`

**Blocked by:** None

**Status:** ready-for-agent

- [ ] A DB-backed spec seeds two teams that double different rounds in one session and asserts the single-team read marks only the asked team's rounds.

Other survivors triaged as not this spec's gap: `standings.service.ts` lines 273/275 (rank tiebreak), 296/437/450 (empty-ids early return, equivalent), 332/333 (per-session filter of already-narrowed rows) are untouched code from before the spec.
