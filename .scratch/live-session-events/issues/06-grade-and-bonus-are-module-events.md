# 06: Grade answer and award bonus are module events

**What to build:** Two admin actions become events in the Live session module:

- **Grading an answer by hand.** The module grades through the answer service, then runs the answer-change refresh for that answer's question.
- **Awarding a bonus over the socket.** The module reads the session's own enabled categories and per-category limit, awards the bonus, then runs the existing bonus-changed refresh with the team's notice.

Invalid grades and invalid bonus awards become module refusals. Both handlers become one-line adapters. The REST bonus routes are not touched.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** done

- [x] A manual grade refreshes the leaderboard, the ungraded markers and that question's admin answer list.
- [x] An invalid grade is refused with today's message.
- [x] A bonus in a disabled category, or over the per-category limit, is refused with today's message.
- [x] A connected team gets the bonus notice, and the leaderboard refreshes.

## Comments

Implemented in the commit `refactor(backend): grade and award bonus are Live session module events` (find it in git history; no hash recorded here).

- `GameStateService.gradeAnswer(joinCode, answerId, pointsAwarded)` grades through the answer service (any error becomes a `SessionRefusal` with the same message), then runs the answer-change refresh for that answer's question. `awardBonus(joinCode, payload)` reads the session's own enabled categories and per-category limit, awards, then runs `bonusChanged` with the team's notice; `InvalidBonusAwardError` becomes a `SessionRefusal`. Both handlers are one-line adapters.
- The REST bonus routes still call `bonusChanged`, so it stays public. `answerGraded` is gone (its only caller was the grade handler).
- Added the missing refusal specs first: unknown answer to grade, disabled bonus category, per-category limit. The existing specs already covered the refresh and the bonus notice.
