# 09: Live edit, live-session REST and the gateway

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `game/live-edit/live-edit.service.ts` | 9 | 7 |
| `game/live-edit/quiz-edit-change.ts` | 6 | 0 |
| `game/rest/live-session-rest.service.ts` | 4 | 1 |
| `game/game.gateway.ts` | 0 | 1 |

Look like real gaps:

- `live-edit.service.ts:121`: `hasLiveSession` (`listLiveSessions(quizId).length > 0`) has no coverage at all, four mutants. `:127`: the `sessions.length === 0` early return. `:154-155`: the "no live session" branch (`liveSessions.length === 0` → persist and reload the lobby sessions) can be removed or forced off. `:201-203`: adding a reloaded session to the deliveries (`some` → `every`, the `quizId` match, the `push` block uncovered): a lobby session of the same quiz that wasn't in the held set.
- `live-edit.service.ts:223`: `swallowErrors: false → true`: a failed delivery must surface after a successful save. `:256-261`: the catch that logs and collects a delivery failure (`failures.push(error)` can be dropped): assert that two failing deliveries are both reported.
- `quiz-edit-change.ts:52`, `:62`: the two `regrade… .length === 0` early returns (block and condition both survive); `:66`: `touchedScores: true → false`; `:72`: the filter to teams that answered. This is the same pair of gaps ticket 03 of `.scratch/mutation-testing-db` closed in `block-grading.service.ts`, one level up: assert a no-op regrade reports no touched scores and no answering teams.
- `live-session-rest.service.ts:156-157`: `inLiveSession`'s `hasSession` check and its `UnknownLiveSessionError` can be removed (survive `false`, the block and the throw): call a REST edit with an unknown join code. `:143`: `notifySessionClosed` can be dropped: assert the sockets are told. `:131`: the update-settings path has no coverage.
- `game.gateway.ts:110`: `?.connected ?? false → true` (no coverage): a team whose socket id is no longer connected.

Look equivalent or low value (disable with a reason): `live-edit.service.ts:258` (log message).

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue". `game.gateway.ts` has 48 compile errors out of 52 mutants, and `live-edit.service.ts` still shows 15 timeouts: check them with `--timeoutMS 120000 --timeoutFactor 5` too (see the spec's "Timeouts").

## Comments
