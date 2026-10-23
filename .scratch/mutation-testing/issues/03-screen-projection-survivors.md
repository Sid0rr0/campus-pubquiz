# 03: What the big screen shows: on-air screen and screen projection

Status: done

Blocked by: 01

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

## Decisions (2026-10-23)

- No open choices. Starts after 01, which writes the direct `session-display-screen` spec; extend that spec rather than adding a second one.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
