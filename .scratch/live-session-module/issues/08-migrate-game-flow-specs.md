# 08: Migrate game-flow specs to the real-store harness

**What to build:** The existing gateway specs about game flow move from the fake-store harness to the real-store harness from 01:
- state transitions and progression
- phase and lock timers
- reveal paging
- closest-guess and showdown reveal
- persistence and restart
- connection/presence
- room scoping
- snapshot leak
- payload validation and logging

Any assertion on internal method calls or their positional arguments is rewritten to assert what rooms and sockets received. Specs keep their intent. This is a migrate batch of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 01

**Status:** done

- [x] Every game-flow gateway spec runs on the real-store harness and passes.
- [x] No migrated spec asserts on fake-store call arguments. Assertions are on room/socket emits or on the snapshot.
- [x] No spec's intent was weakened. Any assertion that couldn't be translated is listed in this ticket's Comments with the reason.

## Comments

Implemented in the commits recorded in `.scratch/overview.md`. `Status:` set to `done`.

**Scope.** The bullets above plus eleven game specs named in neither 08 nor 09 (`admin-actions`, `admin-question-context`, `block-questions`, `core-snapshot`, `notify-session-closed`, `past-revealed-questions`, `presenter-context`, `session-lifecycle-admin`, `set-break-end-time`, `set-display-text-scale`, `update-session-settings`): ticket 10 can only delete the fakes once they move, and they are game flow. Left for 09: the grading, answers, team, bonus, leaderboard and kahoot specs and the three concurrent-sessions specs. `phase-timer.spec.ts` is a pure utility test and needs no harness.

**Harness additions** (`real-store-test-utils.ts`): `payloadsTo`, `connectPlayer`, `teamToken`/`teamCode` on joined teams, `connectAdmin`/`snapshot` for another session, `sessionService`, `orm`, `seedService`, `progressRepository`, the shared `TWO_ROUND_QUIZ` fixture, `tieOnFirstQuestion`, a Date-only fake clock (`freezeClockAt`/`advanceClockBy`/`restoreClock`; timers stay real so Postgres I/O works), and gateway timers cleared after every test.

**Assertions that couldn't be translated, and what replaced them:**

- Illegal transitions now surface as a `WsException` with the message, not `IllegalGameTransitionError`; specs assert the message.
- `applyKahootSpeedScoring` argument checks became points on the leaderboard (a late answer scores between 0 and full). "Does not re-score on PREVIOUS then ADVANCE" now asserts unchanged points; a re-score would give the same value, so this is weaker than the call-count check.
- `gradeClosestGuess` and `computeLeaderboard` call counts/arguments became per-team points at each step; "graded exactly once" is covered only by points not changing through reveal.
- `showdownService.createRound(…, points)` arguments: the points show up as the winner's bonus after resolution (asserted in `showdown-reveal`); `resolve` call counts became "bonus not awarded twice".
- "Does not recompute the leaderboard when toggled off" (an internal call) is now only "toggled off hides it".
- `getConnectedSocketId` / `teamDisconnected` returns became `teams[].isConnected` in the snapshot plus which rooms got a state update. "No stale connection in a new session" now checks the new session's roster is empty.
- `removeFromRoster` call checks became the roster in the snapshot; kicking an unknown team id (999) became kicking a disconnected team.
- Module-destroy timer clearing no longer counts fake timers; it checks that a 1s lock grace passes without the game advancing.
- `isQuestionOpenForAnswering` became "a submit is accepted / rejected with *Answers are locked for this question*".
- A second device joining an existing team needs the team's code or token (the fake ignored this); the specs pass the `teamCode` a first join returned.
- Real join codes are word-based, so the `GHIJKL`-style literal checks became "differs from the original and is addressable".

**Notes for 09/10.** The full suite has more Postgres containers now; five suites (`seed.service`, `grading`, `showdown.service`, `quiz-edited`, `auto-grading`) timed out at ~60s in one full parallel run and passed alone, so consider capping Jest workers or raising the container start timeout in 10. Two unrelated type errors exist in `answer/__tests__/grading.spec.ts` and `stats/__tests__/stats.service.spec.ts`.
