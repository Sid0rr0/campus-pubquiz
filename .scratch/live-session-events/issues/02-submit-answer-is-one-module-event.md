# 02: Submit answer is one module event

**What to build:** A team's answer goes into the Live session module as one event, together with the id of the socket that sent it. Inside, the module:

- checks the question is open for answering
- checks the socket owns the team's seat
- measures the kahoot response time from the same phase start that kahoot speed scoring uses
- submits the answer
- runs the existing answer-change refresh
- returns "answer received" as a reply to the sender

The submit handler becomes a one-line adapter. Teams see exactly what they see today.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** done

- [x] A late answer is refused with "Answers are locked for this question".
- [x] An answer for another team's seat is refused with "You may only submit answers for your own team".
- [x] "Answer received", with graded points for auto-graded types, reaches the sender before the room-wide update.
- [x] In a kahoot round, a faster answer still scores more than a slower one.
- [x] The leaderboard, answered teams and ungraded markers refresh as they do today.

## Comments

Implemented in the commit `refactor(backend): submit answer is one Live session module event` (find it in git history; no hash recorded here).

- `GameStateService.submitAnswer(joinCode, { teamId, questionId, value }, socketId)` replaces `recordAnswer`. It refuses a late answer, then a wrong seat (in that order, as before), measures the kahoot response time from the session's `phaseStartedAt`, submits, runs the answer-change refresh and returns the outcome with the `ANSWER_RECEIVED` reply. `submit-answer.handler.ts` is now a one-line adapter.
- Pinned before the move: exact refusal messages and their order in `submit-answer.spec.ts`, and `kahoot-answer-speed.spec.ts` (a faster correct answer scores more than a slower one). Reply-before-broadcast was already pinned by `outcome-delivery-order.spec.ts`.
- `getPhaseStartedAt` and `isQuestionOpenForAnswering` are no longer used by any handler; they stay until ticket 08 removes the getters (a test still reads the latter).
