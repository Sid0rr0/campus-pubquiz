# 02: Baseline the remaining areas and write survivor tickets

Status: ready-for-agent

Blocked by: 01

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

- Run `pnpm --filter backend mutate:db --mutate <files>` one area at a time (team, league, stats, quiz and import, answer/bonus/joker/showdown, game socket and gateway, live edit and REST, auth, the small rest), in the background, with nothing else testing or mutating at the same time. Keep the incremental file: `game/state/` and 01's pilot are reused, not retested.
- If the initial test run fails, or a spec fails by chance under load, stop and open a bug ticket for that spec.
- Write the baseline into `spec.md` as a table like `.scratch/mutation-testing-db/spec.md`'s (mutants, killed, timeout, survived, no coverage, compile errors, score all / covered, run time), with a row per area.
- Group the survivors and no-coverage mutants into tickets `03-…` onward, as in `.scratch/mutation-testing-db/issues/03-grading-answers-and-bonus-survivors.md`: a file table, likely real gaps, likely equivalent mutants, and a done line using the one-file `mutate:db --mutate <file>` command. List them under the spec's "Tickets" and update the ticket count in `.scratch/overview.md`.

Done when:

- [ ] every area has run and the baseline table is in `spec.md`;
- [ ] the survivor tickets exist and are listed under "Tickets";
- [ ] any flaky spec it exposed has its own ticket.

## Comments
