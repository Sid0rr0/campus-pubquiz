# 07: Answer, joker, player count and feedback

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `answer.service.ts` | 9 | 0 |
| `joker.service.ts` | 4 | 0 |
| `player-count.service.ts` | 2 | 0 |
| `feedback.service.ts` | 3 | 0 |

Look like real gaps:

- `answer.service.ts:45`, `:77-78`: `UNGRADED_MERGE_FIELDS` and the ungraded upsert's `values: { pointsAwarded: 0 }` / `mergeFields` can be emptied: no spec checks that clearing a grade resets `pointsAwarded` and what else it keeps. `:106`: the grade upsert's `fields: ['value', 'gradedAt']`. `:164`: the `questionIds.length === 0` early return. `:259` and `:274`: `isChanged` starts `true` / the flush runs unconditionally: assert that a no-op regrade doesn't flush (spy on the entity manager).
- `joker.service.ts:38`: the upsert `onConflictFields` / `onConflictMergeFields`: re-picking a joker for a team that already has one. `:50-51`: `drawnTeamIds.length > 0` guards the `nativeDelete` of drawn jokers (survives `true` and `>= 0`, and the delete filter can be emptied): a spec with no drawn teams and a spec checking other sources survive.
- `player-count.service.ts:36`: the upsert conflict fields; `:63`: the empty-sessions early return.
- `feedback.service.ts:68-69`: the default `comment: ''` / `topics: []` when a team has no feedback row. `:110`: the upsert conflict options.

Look equivalent or low value (disable with a reason): `answer.service.ts:132` (`fields: ['name']` on the team lookup, a projection only), and the early returns that skip an empty `IN ()` query once checked.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue". `answer.service.ts` still shows timeouts: check it with `--timeoutMS 120000 --timeoutFactor 5` too (see the spec's "Timeouts").

## Comments
