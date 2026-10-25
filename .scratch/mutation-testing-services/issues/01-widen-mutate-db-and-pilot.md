# 01: Widen `mutate:db` to the services and pilot one area

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

- In `apps/backend/stryker.files.cjs`, make the `mutate:db` set `game/state/` plus the role rule from the spec's decisions, minus anything `dbFreeSources()` already returns. Rename `gameStateSources()` to fit (e.g. `dbSources()`) and update its callers.
- Check the result is the spec's 38 files (more if services landed since), and that the excluded roles really are excluded.
- Pilot on one mid-sized area, e.g. `standings/` (`pnpm --filter backend mutate:db --mutate src/standings/standings.service.ts --mutate src/standings/cell-points.ts`). Record mutants, score and run time in this ticket's comments, and extrapolate the other areas' run time from it.
- Update what describes the `mutate:db` set: README "Running mutation tests" (the command list and the "What it covers" bullet), the `pnpm mutate` line in `CLAUDE.md`, and `.claude/skills/implement-spec/SKILL.md` step 11 (it names `gameStateSources()`), logging the skill edit in `docs/agents/skill-changes.md`.

Done when:

- [ ] `mutate:db` mutates `game/state/` plus the role-picked files, and `pnpm --filter backend mutate` is unchanged;
- [ ] the pilot's numbers and the run-time estimate are in the comments;
- [ ] README, `CLAUDE.md` and the implement-spec skill describe the new set.

## Comments
