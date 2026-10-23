# 04: Session snapshot, settle and block-in-play

Status: needs-triage

| File                  | Survived | No coverage | Killed |
| --------------------- | -------- | ----------- | ------ |
| `session-snapshot.ts` | 32       | 34          | 29     |
| `session-settle.ts`   | 25       | 11          | 10     |
| `block-in-play.ts`    | 8        | 17          | 16     |
| `session-settings.ts` | 1        | 9           | 6      |
| `session-state.ts`    | 1        | 0           | 5      |

Examples:

- `session-snapshot.ts:65`: the `displayedKey === session.livePhaseKey` block can be emptied or skipped. `:90`: the per-question answer filter `answer.questionId === question.id` can be `true` or `false`, so a snapshot could attach every answer to every question.
- `session-settle.ts:84`: the `TOGGLE_JOIN_OVERLAY` check can be forced either way.
- `block-in-play.ts:61`: the `status === 'ended'` branch can be removed, inverted or forced.
- `session-state.ts:218`: the `isDisplaySoundMuted: false` default → `true` survives.

These feed the reconnect/resync path (CODING_STANDARDS), so a wrong snapshot shows up as a wrong screen after a redeploy.
