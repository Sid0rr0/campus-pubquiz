# 03: Answer recorded / answer graded owned by the Live session module

**What to build:** Recording a team's answer and grading an answer become Live session operations. The module refreshes every derived cache the change affects:

- the leaderboard
- the ungraded-question ids, using one rule that always excludes closest_guess (shared with the bulk refresh on entering grading statuses)
- the answered-team ids

The outcome names the question whose admin answer list must be pushed. The quiz master sees correct totals right after an auto-graded submit, and closest_guess questions never show a "not yet graded" dot. See the spec's user stories 1, 4, 5, 13–16, 21 and 31 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** done

- [x] Regression test (real-store harness): after a team submits a correct multiple_choice answer, the next state snapshot's leaderboard shows that team's points.
- [x] Regression test: after a closest_guess submit during question_open, the snapshot's ungraded-question ids do not include that question.
- [x] Test: grading the last ungraded answer to a question removes it from the ungraded ids. A team changing an already-graded answer puts it back.
- [x] The submitting team still receives its ANSWER_RECEIVED acknowledgement, and locked/hidden-question and wrong-team rejections keep today's messages.
- [x] The admin room receives the question's answer list after every submit and grade, via the outcome.
- [x] The submit and grade socket handlers no longer set the leaderboard, answered ids or graded status themselves.

## Comments

Implemented in commit `22dad1f`. `Status:` set to `done`.

- `GameStateService.recordAnswer` / `answerGraded` share one refresh and return an outcome naming the question's admin answer list; the handlers only call them and `deliverOutcome`. The one "ungraded" rule is `canBeUngraded` in `block-grading.service.ts`, used by the incremental and bulk paths.
- The real-store seed gained an `audio` question (last in the round) so a human-graded answer exists; the timer spec's advance count went from 4 to 5.
- `GameStateService.setQuestionGradedStatus` is gone. `setAnsweredTeamIds` and `setLeaderboard` remain public for other callers until ticket 07.
- Fake-harness specs adjusted: the concurrent-sessions fake now gives `GameStateService` the same answer store as the gateway, and B's leaderboard legitimately holds its own team after B submits.
- Delivery order on submit/grade is now snapshot, then the admin answer list (it used to be the reverse), the same shift ticket 02 made for admin actions.
