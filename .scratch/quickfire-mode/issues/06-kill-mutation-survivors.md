# 06: Kill the mutation survivors in the quiz-mode code

**What to build:** Add specs that kill the Stryker survivors left in the files the quickfire-mode spec changed. No behaviour change.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** none

**Status:** ready-for-agent

Scores from the spec's final run: shared/types 99.70%, backend DB-free 100%, frontend 97.25%, backend DB-backed (`mutate:db`) 86.93% (79+ survivors, 151 timed out; log: `/tmp/mut/be-db.log` on the author's machine, rerun `pnpm --filter backend mutate:db --mutate <files>`).

- [ ] `quiz.service.ts`: the "a quiz's mode can't be changed" refusal (`mode !== quiz.mode`, its field and message) is not pinned by a spec (lines ~247-255).
- [ ] `league.service.ts`: the quickfire league-add refusal and its message (line ~145) and the `QuickfireLeagueError` mapping.
- [ ] `import.service.ts`: two `MethodExpression` survivors at lines 26 and 54 (the mode handed to the row parser).
- [ ] `team.service.ts` / `team-history.service.ts`: the `showQuickfireOnly` filter and quickfire-night stats survivors.
- [ ] Remaining survivors in `live-edit.service.ts`, `game-state.service.ts`, `bonus-awards-changes.ts`, `league-table.service.ts`, `stats.service.ts`: triage each, kill or mark equivalent (see the Stryker disable comment memory in CLAUDE docs).
- [ ] One shared/types survivor and two frontend survivors: rerun for the list.
