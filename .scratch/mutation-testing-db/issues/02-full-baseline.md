# 02: Full `mutate:db` baseline and survivor tickets

Status: ready-for-agent

Blocked by: 01

**Type:** task

Run `pnpm --filter backend mutate:db` over all of `game/state/` and turn the result into survivor tickets.

- Expect about 1.5 hours (01's comments). Run it in the background and run nothing else that tests or mutates at the same time. Keep `reports/stryker-db-incremental.json` from 01's pilot: `joker-changes.ts` is reused, not retested.
- If the initial test run fails or a spec fails by chance under load, stop and open a bug ticket for that spec (spec decision: a flaky spec is a bug, not left out). Work it like follow-up ticket 01.
- Write the baseline into `spec.md` as a table like the one in `.scratch/mutation-testing/spec.md`: mutants, killed + timeout, survived, no coverage, compile errors, score (all / covered), run time. Add a row per file if the spread is wide.
- Group the survivors and no-coverage mutants by area into tickets `03-…` onward. Each ticket names its files, the mutants that look like real gaps and the ones that look equivalent, and has a done line. They're worked as in `.scratch/mutation-testing/spec.md` "How to work an issue", with `pnpm --filter backend mutate:db --mutate <file>` as the one-file command.
- Note how many mutants timed out. If timeouts dominate the run time, say so in the spec, since a lower `timeoutMS` might be a follow-up.

Done when:

- the full run has finished and its baseline table is in `spec.md`;
- the survivor tickets exist and are listed under the spec's "Tickets";
- any flaky spec it exposed has its own ticket.
