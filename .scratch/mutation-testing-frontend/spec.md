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

## Tickets

1. Wire up `mutate` and run the baseline (`issues/01-wire-up-and-baseline.md`).
2. Survivor tickets, written from the baseline once 01 is done.
