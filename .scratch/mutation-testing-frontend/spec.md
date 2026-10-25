# Mutation testing: the frontend

Status: ready-for-agent

`pnpm mutate` covers `shared/types` and the backend, but not the frontend (README "Running mutation tests": "`frontend`: not covered"). The game rules live in `shared/types` and are covered there. The frontend's own logic is client state (team link, quiz draft), view helpers, hooks and API parsers, and no mutation run measures how well its specs pin that logic.

Do this after `.scratch/mutation-testing-db`.

## Decisions (2026-10-24)

- **`pnpm --filter frontend mutate`**, which `pnpm mutate` picks up like the other workspaces. It uses the Stryker Vitest runner, is incremental like the others, and is capped at 8 workers.
- **Mutate the non-component `.ts` modules in `app/` only**, for example `lib/team-link.ts`, `quizzes/[id]/quiz-draft-state.ts`, `lib/use-team-link.ts`, `components/leaderboard-rows.ts`, and the `lib/*-api.ts` parsers. Specs, `.d.ts` files and `.tsx` components stay out: in components, most survivors would be Tailwind class strings and display copy that no test should pin. Components may get a later trial run with the string-literal mutator turned off.
- **The same pattern as before:** wiring and a baseline, then survivor tickets grouped by area, worked as in `.scratch/mutation-testing/spec.md` "How to work an issue".
- **"Test it where it lives" is decided per ticket for now.** Logic in a `.ts` module that only a component's render test reaches will show up as survivors. Each ticket picks between a direct spec and a sharper component assertion. Once the baseline is in, revisit whether `CODING_STANDARDS.md` should require direct specs for frontend `.ts` logic.
- Keep memory use low: Vitest's own `maxWorkers` must not multiply with Stryker's 8 workers. Check how the Vitest runner sets it.

## Baseline

Run 2026-10-24 (clean, no incremental file), 75 source files, `pnpm --filter frontend mutate`:

| Workspace                      | Mutants | Killed + timeout | Survived | No coverage | Score (all / covered) | Run time |
| ------------------------------ | ------- | ---------------- | -------- | ----------- | --------------------- | -------- |
| `frontend` (non-component `.ts`) | 2292    | 1639             | 396      | 257         | 71.5% / 80.5%         | ~12 min  |

A further 1255 mutants failed to compile, so the TypeScript checker dropped them. `[id]` paths match: the quiz editor and `stats/[id]` files are in the run. `app/**/__tests__/**` is excluded too (the `fake-socket.ts` helper), beyond the ticket's `*.test.ts` and `*.d.ts`. Work each survivor ticket as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Open follow-ups

- ~~Revisit whether `CODING_STANDARDS.md` should require direct specs for frontend `.ts` logic.~~ Decided 2026-10-25: no rule. The `shared/types` rule exists because `pnpm mutate` can't see tests in other workspaces, but the frontend's Stryker run includes every Vitest test, component render tests too, so a sharper component assertion counts. Tickets keep choosing case by case.
- ~~The "works with storage unavailable" tests in `app/display/__tests__/reconnect.test.tsx` and `app/play/__tests__/player-count.test.tsx` never block storage under happy-dom.~~ Done 2026-10-25: they spy on `window.localStorage`, and each fails with its storage module's `try`/`catch` removed.

## Tickets

1. Wire up `mutate` and run the baseline (`issues/01-wire-up-and-baseline.md`).
2. Survivor tickets, grouped by area (survived / no coverage):
   - `issues/02-team-link-and-storage.md` (~100)
   - `issues/03-quiz-editor-drafts.md` (~105)
   - `issues/04-api-clients.md` (~230, mostly no coverage)
   - `issues/05-control-hooks.md` (~50)
   - `issues/06-connection-and-lib-hooks.md` (~60)
   - `issues/07-play-display-view-helpers.md` (~85)
