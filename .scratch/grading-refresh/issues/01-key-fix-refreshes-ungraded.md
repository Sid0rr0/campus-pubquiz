# 01: A live answer-key fix refreshes /control's ungraded markers

**What to build:** When the quiz master corrects an answer key during a live session, `/control`'s ungraded markers and showdown eligibility are right the moment the key is saved. Today a key fix can clear a typed answer's automatic grade, or grade a waiting answer that now matches, but the key-fix path refreshes only the leaderboard. So the markers stay wrong until some other event refreshes that question, and on the last block the showdown can be offered over an ungraded answer.

The fix introduces the **grading refresh** in the block grading module. Given the session and the questions whose grades just changed, it returns which of them are ungraded (through the existing ungraded reader) together with fresh standings, for the caller to apply in one synchronous update. The key-fix path ends through it for every question it re-graded, in any game status. The re-grade itself is unchanged. Other paths move onto the refresh in tickets 02 and 03.

Parent spec: `.scratch/grading-refresh/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] New ungraded agreement-walk steps are written first and fail against today's code:
  - in the break, a key fix on a typed question whose answers were all auto-matched makes one stop matching, and the question appears in the set
  - in the break, a key fix makes a question's only waiting answer match, and the question disappears from the set
- [x] Agreement-walk steps for a key fix on a typed question while it is still open for answering, in both directions.
- [x] On the last block, a key fix that leaves an answer ungraded makes showdown eligibility false until that answer is graded. Put this check wherever showdown eligibility is pinned today.
- [x] The existing key-fix steps in the walk still pass: auto-graded, typed with the question already ungraded, and closest_guess.
- [x] The key fix applies the refresh without a read-modify-write of the session across an `await`.
- [x] The leaderboard, the admin's answer lists and the phones' team sync after a key fix are as today. The live edit regrade spec passes unchanged.
- [x] `CONTEXT.md` gains **Ungraded** (an answer still waiting for the quiz master, and a question with one) and **Grading refresh** (the one step every change to grades ends through), the latter next to **Settle step**.

## Comments

Implemented in the commit titled `feat(backend): a live answer-key fix refreshes the ungraded markers` (see git history for the hash).

- `BlockGradingService.gradingRefresh` returns the ungraded ids and fresh standings; `withGradingRefresh` applies them. `regradeQuestions` now only writes grades, and `GameStateService.regradeQuestions` ends through the refresh.
- The refresh only covers questions in the current block, since the cached set describes the block in play. A key fix on a past block's question changes no marker.
- The new walk steps live in `ungraded-agreement.spec.ts`, showdown eligibility included, and failed against the old code first.
- `/guide` says nothing about markers after a key fix, so it is unchanged.
