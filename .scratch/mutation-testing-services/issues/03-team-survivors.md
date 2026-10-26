# 03: Team, team merge and team history

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `team.service.ts` | 18 | 7 |
| `team-merge.service.ts` | 25 | 4 |
| `team-history.service.ts` | 2 | 0 |

Look like real gaps:

- `team.service.ts:62-65`: the `averagePlacing` comparator. Both-null (`:62`, six mutants), `+1` for a null `b` (`:64`, no coverage) and the `direction * (a - b)` arithmetic (`:65`) survive, so no spec sorts teams where two have no placing, or reads the comparator's sign on a descending sort. `:176` and `:191`: the `sortBy === 'averagePlacing'` and `'sessionsJoined'` branches can be forced.
- `team.service.ts:121`: `!normalizedCode || normalizedCode !== existingByName.code` survives `&&` and `|| false`: no spec joins an existing name with a wrong code and with no code separately. `:138-139`: the unique-violation race path (`isUniqueViolation` → `TeamNameTakenError`) has no coverage; stub the repository to throw it. `:282-283`: the empty-code guard (`InvalidJoinCodeError`) can be removed.
- `team-merge.service.ts:82-83`: the refusal sentence. `kind === 'shared_session'` can be forced either way and the capitalisation (`charAt(0).toUpperCase()`, `slice(1)`) can change. Assert the reason text of both kinds.
- `team-merge.service.ts:104`, `:115`, `:138`, `:164`: the `runOn(em, inTransaction)` flag and the `params = []` default. A spec that checks the preview runs outside a transaction and the merge inside one (or that the preview leaves the data untouched on a failure).
- `team-merge.service.ts:167`: `teamId !== otherTeamId` guards the `for update` lock; `:185`: `a <= b` picks the earlier of two timestamps (`<` survives when equal); `:246`: `others.length === 0` early return; `:318-319`: tie-break by the later time, then by the higher id (four no-coverage mutants: merge two teams with the same timestamp).
- `team-history.service.ts:133` and `:136`: the two empty-input early returns.

Look equivalent or low value (assert the message, or disable with a reason): the error `name` and message strings at `team.service.ts:26-43` (the `:26` and `:27` pair is not covered at all), `team-merge.service.ts:16-17`, `:176` (the "name must be one of the two" message) and `:219`.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue". Check any file still showing timeouts with `--timeoutMS 120000 --timeoutFactor 5` (see the spec's "Timeouts").

## Comments
