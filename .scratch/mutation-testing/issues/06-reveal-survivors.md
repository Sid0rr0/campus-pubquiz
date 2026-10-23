# 06: Reveals: closest-guess walk, stepped reveal, showdown, leaderboard

Status: done

Blocked by: 01

| File                      | Survived | No coverage | Killed |
| ------------------------- | -------- | ----------- | ------ |
| `closest-guess-reveal.ts` | 14       | 43          | 2      |
| `stepped-reveal.ts`       | 29       | 4           | 31     |
| `showdown-reveal.ts`      | 14       | 0           | 7      |
| `leaderboard-reveal.ts`   | 6        | 1           | 23     |
| `leaderboard-board.ts`    | see 01   |             |        |

Examples:

- `closest-guess-reveal.ts`: 43 of 59 mutants aren't covered by any `shared/types` test. `:94` (the `revealKind !== 'closest_guess'` guard) and `:150` (`status !== 'reveal'`) survive.
- `stepped-reveal.ts:122`: `current.status === 'ended' && next.status === 'ended'` survives every mutation.
- `showdown-reveal.ts:17-18`: the sort by `seatIndex` can be dropped or turned into `a + b`, so seat order isn't asserted. `:27`: `hasGuessed` can be forced to `true` or `false`.

## Decisions (2026-10-23)

- No open choices. Starts after 01, which writes the direct `leaderboard-board` spec; extend it rather than adding a second one.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
