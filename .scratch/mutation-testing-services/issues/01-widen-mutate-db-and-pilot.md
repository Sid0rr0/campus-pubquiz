# 01: Widen `mutate:db` to the services and pilot one area

Status: done

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

**Set.** `dbSources()` in `apps/backend/stryker.files.cjs` (renamed from `gameStateSources()`; `stryker.db.config.mjs` is its one caller) returns 54 files: 17 in `game/state/` (the other 3 of its 20 are in the DB-free slice) and 37 picked by role. The spec's 38 included `log-buffer.service.ts`, which isn't on this branch's base (it sits in the main checkout's `logs/`), so the rule will pick it up once it lands. Controllers, modules, guards, decorators, `db/`, the `*-http*.ts` mappers, schema files, socket types and event declarations are out. `pnpm --filter backend mutate` is unchanged.

**Pilot** (`standings/standings.service.ts` + `cell-points.ts`, 481 lines, 8 workers): 184 mutants, 48 of them compile errors (excluded from the score), 4 killed, 131 timeouts, 0 survivors, 1 no-coverage. Score 99.26% (covered 100%). Run time 30m48s, of which the initial run of 1526 tests took 1m46s. That is about 3.8 s per source line, or about 12.6 s per tested mutant. Most detections are timeouts rather than kills, so the score likely overstates test strength; worth a look in ticket 02 (a mutant that hangs a DB-backed spec counts as detected).

**Gotcha.** A repeated `--mutate a --mutate b` keeps only the last one (my first pilot mutated `cell-points.ts` alone). Pass one comma-separated list: `--mutate a,b`. README now says so; the implement-spec skill step 11 also writes repeated flags and should be corrected.

**Extrapolated run time** at 3.8 s/line plus ~2 min fixed per area: team (782 lines) ~52m, stats (598) ~40m, quiz (425) ~29m, ended-sessions-read (420) ~28m, league (409) ~28m, game/socket (777) ~51m, game/live-edit + game/rest + game.gateway (906) ~60m, answer (344) ~24m, auth (282) ~20m, showdown (202) ~15m, import (206) ~15m, bonus (186) ~14m, feedback (144) ~11m, joker + player-count + media (203) ~15m. The 37 role-picked files total about 6.4k lines, about 7 hours; `game/state/` (3.6k lines) is about 3.8 hours more.

**Skill.** `.claude/skills/implement-spec/SKILL.md` is gitignored and absent from the worktree, and this agent could not edit the main checkout's copy, so the edit is still to make by hand: step 11 should say `.dbSources()` instead of `.gameStateSources()`, and that its files (`game/state/`, services and logic modules) go through `mutate:db`. The change is logged in `docs/agents/skill-changes.md`.
