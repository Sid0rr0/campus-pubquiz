# 03: What the big screen shows: on-air screen and screen projection

Status: needs-triage

| File                        | Survived | No coverage | Killed |
| --------------------------- | -------- | ----------- | ------ |
| `on-air-screen.ts`          | 72       | 35          | 38     |
| `display-screen.ts`         | 14       | 2           | 20     |
| `screen-projection.ts`      | 11       | 2           | 3      |
| `session-display-screen.ts` | 7        | 0           | 0      |

Examples:

- `on-air-screen.ts:95-98`: the `locking` case can return `{}`, an empty `ROUND n` label, or `roundTitle && ''`, and no test fails.
- `screen-projection.ts:58-62`: `progress.status === 'reveal'` can be forced to `true` or `false`, and `revealQuestions.slice(0, shownCount)` can return them all, so a reveal could show unrevealed questions without a test noticing.
- `display-screen.ts:102`: `answerMediaUrl ?? mediaUrl` → `answerMediaUrl && mediaUrl` survives (the answer media rule from the control-availability spec).

Check issue 01 first: some of this may be tested from the frontend.
