# 09: Migrate grading, answers and team specs to the real-store harness

**What to build:** The existing gateway specs about answers and scoring move to the real-store harness from 01:
- submit
- grading and the grading gate
- leaderboard
- response indicators
- kahoot scoring/timers/answer gate
- live-edit regrade
- team answer sync
- bonus awards
- join/kick/leave
- roster/answer isolation

The concurrent-sessions specs move too, replacing their separate session-aware fake fixture module. Positional-argument assertions (e.g. on the regrade call) become room-visible assertions. This is a migrate batch of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Every grading/answers/team gateway spec, including the concurrent-sessions specs, runs on the real-store harness and passes.
- [x] No migrated spec asserts on fake-store call arguments.
- [x] Nothing depends on the concurrent-sessions fake fixture module any more.
- [x] Any assertion that couldn't be translated is listed in this ticket's Comments with the reason.

## Comments

Migrated in the commit titled `test(backend): migrate grading, answers and team specs to the real-store harness`. Fifteen specs moved: `submit-answer`, `grading`, `grading-gate`, `leaderboard`, `response-indicators`, `join-players`, `award-bonus`, `live-edit-regrade`, `team-answers-sync`, `kahoot-question-timer`, `kahoot-question-auto-advance`, `kahoot-leaderboard-answer-gate` and the three concurrent-sessions specs (`state-progression-isolation`, `question-lock-timer-isolation`, `roster-answer-grading-isolation`). `team-removed`, `bonus-changed`, `answer-recorded-and-graded` and `quiz-edited` were already on the real-store harness from tickets 03–06. `concurrent-sessions-test-utils.ts` is deleted; the harness's `connectPlayer`/`joinTeam` gained an optional `joinCode` so a team can join a second session. `test-utils.ts` still holds the fakes (and `asSocket`/`createMockSocket`, which the real-store harness imports) for ticket 10. Full `src/game` suite: 53 suites, 324 tests pass; eslint clean on `src/game/__tests__`.

**Assertions that couldn't be translated, and what replaced them:**

- `answerService.*` / `teamService.*` / `bonusService.*` call arguments (`submit`, `grade`, `join`, `award`, `listForTeam`, `computeLeaderboard`) became rows read back from the real store (`listForQuestion`, `bonusService.listForTeam`) and what the rooms received (answers list, leaderboard, `JOIN_ACCEPTED` contents). "Not called" checks became "nothing stored".
- `UngradedAnswersError` became a `WsException` (the gateway wraps it); the grading-gate spec asserts the rejection and that the status stayed `break_intro`.
- `isQuestionOpenForAnswering` became "a submit is accepted / rejected as locked".
- `arrange(service).setLeaderboard` / `setAnsweredTeamIds` (state injection) became real answers: the leaderboard spec has teams submit correct/wrong answers instead. "Starts with an empty leaderboard" now means a session with no teams.
- `regradeAutoGraded(…, speedMultipliers)` arguments became stored points: a kahoot answer given at half the 10s timer scores 8 of 10, and after the key is corrected to 20 points the regrade stores 15 (20 × the recorded 0.75), not 20. The "load before regrade" call-order check is covered by the corrected key taking effect (`quiz-edited.spec.ts`); "skips regrading when no graded field changed" is `quiz-edited.spec.ts`'s "only reloads and broadcasts…".
- `gradeClosestGuess` arguments became per-team points before and after the target is corrected (Near 3/Far 0 → Near 0/Far 3).
- Kahoot auto-advance used fake timers advanced by 30–60s; it now uses a real 1s timer (and a 2.5s quiet period for the "no timer" and "cancelled" cases), so those two checks are real-time waits rather than instant. The kahoot deadline specs freeze only `Date` (`freezeClockAt`), and the rehydrate case uses `restart()` instead of a hand-built progress repository.
- A second device joining a team needs the first to be disconnected (the fake ignored this): the join spec disconnects the first phone, and adds a test that a still-connected team rejects a second device.
- `getGameSessionId`/`getQuestionLockAt` checks in the concurrent specs became snapshots per join code and which rooms received emits; the two sessions share one quiz (and so question ids), so isolation is proved by per-session answers, rosters and emits rather than distinct ids.
- Team names are unique across sessions, so the two-gateway specs use different team names.
