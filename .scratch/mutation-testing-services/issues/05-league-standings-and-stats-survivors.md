# 05: League, standings, stats and ended sessions

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `league.service.ts` | 17 | 0 |
| `league-table.service.ts` | 4 | 0 |
| `standings.service.ts` | 11 | 1 |
| `stats.service.ts` | 4 | 1 |
| `ended-sessions-read.ts` | 3 | 0 |

Look like real gaps:

- `league.service.ts:107`: the move-up/down bound `target >= ordered.length` survives `false` and `>`: no spec moves the last league down (or the first up). `:91`: the `sortOrder desc, limit 1` lookup survives `{}` and `orderBy: {}` (a new league isn't placed after the highest sort order). `:148`: the membership `nativeDelete` filter, `:218` and `:220`: the `wanted.length === 0` early return and the `$in` filter, `:246-248`: the `populate` and `orderBy` of the membership read.
- `league-table.service.ts:117`: `row.leaguePoints <= 0` survives `false` and `< 0`: a team with zero league points is listed. `:137`: empty-sessions early return. `:91`: the `order: 'desc'` tie-break by league id.
- `standings.service.ts:182`: `responseMs === null ? null : Number(...)` survives all three forms (a null and a non-null response time). `:231-232` and `:325-326`: the per-session `gameSessionId` filters (`rounds` and `answerRows`) can be dropped or made `true`: a spec with two sessions in one call. `:266` and `:268`: the total-points / name / team id sort (the last tie-break is uncovered). `:289`, `:296`, `:455`: the empty-input early returns.
- `stats.service.ts:267`: `isKahoot: extras?.isKahoot ?? false` flipped to `true` (no coverage): a session with no extras. `:141`: the `maxPoints` sort column maps to `max_points`; `:547-548`: the `gs.id desc` and `r.order_index asc` orders.
- `ended-sessions-read.ts:251`: `teamIds.length === 0` early return. `:325`: the `teamId !== undefined` filter on the jokers query can be dropped (the block is also removable): a spec asking for one team's jokers among several.

Look equivalent or low value (assert the message, or disable with a reason): the exception messages at `league.service.ts:19-44`, `stats.service.ts:398`; early returns that only skip an empty `IN ()` query (`standings.service.ts:289`, `:296`, `:455`, `ended-sessions-read.ts:251`, `league-table.service.ts:137`) are equivalent if the query on an empty list returns nothing: disable with that reason once checked.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue". `standings.service.ts` and `ended-sessions-read.ts` still show timeouts: check them with `--timeoutMS 120000 --timeoutFactor 5` too (see the spec's "Timeouts").

## Comments
