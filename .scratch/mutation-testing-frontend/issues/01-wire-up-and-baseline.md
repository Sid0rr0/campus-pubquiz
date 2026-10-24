# 01: Wire up the frontend `mutate` and run the baseline

Status: ready-for-agent

Blocked by: `.scratch/mutation-testing-db` (spec order, not a technical dependency)

**Type:** task

Add `@stryker-mutator/vitest-runner` and a `stryker.config.mjs` to `apps/frontend`, modelled on `shared/types/stryker.config.mjs`: name the plugins explicitly (pnpm hides them from discovery), use the TypeScript checker, per-test coverage, concurrency 8, and `thresholds.break: null`. Give the workspace a `mutate` script so `pnpm mutate` runs it.

Mutate set: `app/**/*.ts` minus `*.test.ts` and `*.d.ts`. Note that `[id]` in paths is a glob character class, so check the quiz editor files actually match.

Then run the full baseline and write it to the spec as a table like the one in `.scratch/mutation-testing/spec.md` (mutants, killed + timeout, survived, no coverage, score, run time). Group the survivors into ticket files `02-…` onward.

Done when:

- `pnpm --filter frontend mutate` and `pnpm mutate` run the frontend, and `pnpm --filter frontend test` is unchanged;
- the README "Running mutation tests" section says what the frontend run covers, in the same commit;
- the baseline table is in the spec and the survivor tickets exist.
