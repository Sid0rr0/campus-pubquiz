# 04: Joker changes

Status: ready-for-agent

Blocked by: None

**Type:** task

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `joker-changes.ts` | 12 | 3 |

(Counts come from the pilot in ticket 01; the full run reused them.)

Look like real gaps:

- `:96-97`: the "team is not in this session" check can be removed or inverted (`false`, `some(() => true)`, `!==`) and its message blanked.
- `:137`: `shouldBroadcastAdminState: true → false`; `:141`: `touchedScores: true → false`. Assert both flags on the outcome.
- `:214-215`: `status !== 'joker_pick' && … ` and `status !== 'ended'` can each be forced to `true`: the status gate isn't tested for every status.
- `:327`: the "best kept round" pick (`kept > best.kept`) has no coverage for ties or a lower later candidate (3 no-coverage mutants, 1 survivor).

Look equivalent or low value: the message strings at `:73` and `:109` (assert them, or disable with a reason).

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".
