# 11: Re-baseline `game/state/` under the new timeout

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

`.scratch/mutation-testing-db/spec.md` recorded the `game/state/` baseline under Stryker's default timeout, and 459 of its 565 detected mutants were timeouts. The services run showed that limit counts slow-but-passing mutants as timeouts and hides survivors (see "Timeouts" in the parent spec: 93 survivors under the default limit, 198 under `timeoutFactor: 3` / `timeoutMS: 30000`). The `game/state/` survivor tickets (`.scratch/mutation-testing-db/issues/03-07`) were written from the smaller list.

- Run `pnpm --filter backend mutate:db --reporters clear-text,json --mutate <the 17 files under src/game/state/>` (comma-separated, from `dbSources()`). It goes into `reports/stryker-db-incremental-v2.json`, which holds the services' results and nothing from `game/state/`, so every mutant is tested: expect about 4 hours, with nothing else testing or mutating at the same time. If it is too long, run it in two or three directories at a time.
- Add a table like the parent spec's to this ticket's comments, with the mutants that survive now and did not before.
- Group the new survivors and no-coverage mutants into follow-up tickets (`12-…` onward) like 03-10, or add them to the open `mutation-testing-db` tickets if those are still open.

Done when:

- [ ] `game/state/` has a baseline under the new timeout, in this ticket's comments;
- [ ] the new survivors have tickets or are listed in an existing one.

## Comments
