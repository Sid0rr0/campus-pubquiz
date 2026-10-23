# Mutation testing: first audit

Status: ready-for-agent

`pnpm mutate` (Stryker, see README "Running mutation tests") was run for the first time on 2026-10-23. The issues in `issues/` group its survivors by area. Each one says which mutants survived, which of them look like real gaps, and which look equivalent (no test could catch them).

## Baseline

| Workspace                     | Mutants | Killed + timeout | Survived | No coverage | Score (all / covered) | Run time |
| ----------------------------- | ------- | ---------------- | -------- | ----------- | --------------------- | -------- |
| `shared/types`                | 4411    | 1607             | 628      | 280         | 63.9% / 71.9%         | ~4 min   |
| `backend` (DB-free slice)     | 2881    | 1001             | 305      | 477         | 56.1% / 76.7%         | ~9 min   |

The rest of the mutants failed to compile, so the TypeScript checker dropped them (1896 in `shared/types`, 1098 in the backend).

## How to work an issue

1. Mutate only the files the ticket names. Run it from the workspace (`shared/types` or `apps/backend`), one `--mutate` per file:
   `pnpm exec stryker run --incremental --mutate src/control-availability.ts`
   A one-file run takes seconds. It reuses the workspace's `reports/stryker-incremental.json` if one exists and keeps the other files' results in it. Don't run the full `pnpm mutate` while other tickets run in parallel: each full run starts about 13 worker processes.
2. Read the survivors in the clear-text output, or in `reports/mutation/mutation.html`.
3. Add the missing assertions, or mark a truly equivalent mutant with `// Stryker disable next-line <mutator>: <reason>`.
4. Rerun the same command until the ticket's done line holds, then set the ticket's `Status: done`.

## Limits of the run

- Each workspace only sees its own tests. Many `shared/types` modules are tested only through frontend or backend specs, so they show up as survivors or "no coverage" here (issue 01).
- The backend run leaves out every DB-backed spec (about 140 of 203), so `game/state/*-changes.ts` shows no coverage at all (issue 12 drops them from the mutated set).
