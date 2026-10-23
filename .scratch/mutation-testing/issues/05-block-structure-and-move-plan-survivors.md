# 05: Block questions, move plan and live-edit frontier

Status: done

Blocked by: None

| File                   | Survived | No coverage | Killed |
| ---------------------- | -------- | ----------- | ------ |
| `block-questions.ts`   | 50       | 14          | 15     |
| `move-plan.ts`         | 39       | 18          | 27     |
| `live-edit-frontier.ts`| 0        | 14          | 43     |
| `block-in-play.ts`     | see 04   |             |        |

Examples:

- `block-questions.ts:43`: `margin !== undefined ? { ...stored, margin } : stored` survives all three mutations, so nothing checks that a per-block margin override reaches the question. `:49`: the `revealKind === 'answer'` branch can be skipped.
- `move-plan.ts:18`: `action === 'ADVANCE' || action === 'PREVIOUS'` can be forced to `true` or `false`. `:95`: the media-move guard (`REPLAY_MEDIA` / `TOGGLE_MEDIA_PAUSE`) can be forced to `true`, which is the refusal the control-availability spec added.
- `live-edit-frontier.ts`: 14 mutants are not covered by any `shared/types` test.

## Decisions (2026-10-23)

- No open choices. Leave `block-in-play.ts` to 04.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
