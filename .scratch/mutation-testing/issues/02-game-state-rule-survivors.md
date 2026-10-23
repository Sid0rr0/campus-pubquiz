# 02: Game state machine: close the survivors in the transition rules

Status: done

Blocked by: None

The state machine scores 94–98%, but the survivors that remain change real game flow:

- `game-state-timed-phase.ts:29-31`: the whole kahoot-mode branch can be emptied (`{}`), or `&&` swapped for `||`, and no test fails. That suggests nothing checks when a kahoot round enters its timed phase.
- `game-state.ts:189` and `game-state-forward-transitions.ts:130`: `Math.max(progress.furthestOpenIndex, …)` → `Math.min(...)` survives. No test advances after going back, which would catch the furthest-open index moving backwards.
- `game-state-block-position.ts:58`: the last-round guard `position.roundIndex + 1 >= context.rounds.length` survives `>` → `>=`, `+` → `-` and `false`. No test steps past the last round.
- `game-state-structure.ts:37` and `:53`: `index === -1 ? 0 : index + 1` and `breakNumber > 0 && breakNumber === blockCount` (the final-break check) survive.
- `game-state-backward-transitions.ts:171`: `if (progress.revealIndex === 0)` → `true` survives.
- `game-state.ts:285`: `if (progress.status === 'ended')` → `true` survives on the PREVIOUS path.
- `game-state-forward-transitions.ts:52`: the error message text survives. That's probably fine (equivalent unless a test asserts the message).

Priority: high. These are the moves the moderator presses live.

## Decisions (2026-10-23)

- Disable the error-message mutant at `game-state-forward-transitions.ts:52` with a reason (invalid-config error text, not player-facing). Every other survivor listed above gets a test.
- Priority: high.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
