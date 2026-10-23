# 06: Reveals: closest-guess walk, stepped reveal, showdown, leaderboard

Status: needs-triage

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
