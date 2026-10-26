# 10: Game socket helpers

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `game/socket/connection.util.ts` | 3 | 3 |
| `game/socket/phase-timers.ts` | 2 | 2 |
| `game/socket/session-broadcaster.ts` | 1 | 4 |
| `game/socket/outcome-delivery.util.ts` | 0 | 2 |
| `game/socket/acknowledge.util.ts` | 1 | 0 |
| `game/socket/answers-updated-payload.util.ts` | 0 | 1 |

Look like real gaps:

- `connection.util.ts:27`: `if (!token) return null` can be forced off: a connection with no token. `:131`: the `hasSession(joinCode)` guard on disconnect (three mutants, no coverage): disconnect a socket whose session is already gone.
- `acknowledge.util.ts:26`: `data === undefined ? … : …` survives `false`: an acknowledgement with no data.
- `session-broadcaster.ts:129-138`: the catch blocks around the league-top broadcast and refresh (four mutants, no coverage): make the league read reject and assert the broadcast carries on. `:169`: `socket.disconnect(true)` → `false` (closes the connection or only the namespace): assert the call's argument on a disconnected user.
- `phase-timers.ts:128-130`: the `ADVANCE failed` catch (no coverage): make the advance reject. `:100`, `:110`: the `'Auto-lock'` and `'Joker pick close'` labels, which only matter in the log line the catch writes: assert them once `:128` is covered.
- `answers-updated-payload.util.ts:14`: the unknown-question `WsException` (message uncovered).

Look equivalent or low value (disable with a reason): `connection.util.ts:56` and `:136` (log lines), and `outcome-delivery.util.ts:146` and `:163`, the `default: return x satisfies never` branches, which the type system keeps unreachable.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue". `connection.util.ts`, `phase-timers.ts` and `session-broadcaster.ts` still show timeouts (70 across the area): check them with `--timeoutMS 120000 --timeoutFactor 5` too (see the spec's "Timeouts").

## Comments
