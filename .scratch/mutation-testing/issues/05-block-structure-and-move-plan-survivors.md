# 05: Block questions, move plan and live-edit frontier

Status: needs-triage

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
