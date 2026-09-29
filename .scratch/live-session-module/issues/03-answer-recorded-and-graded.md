# 03: Answer recorded / answer graded owned by the Live session module

**What to build:** Recording a team's answer and grading an answer become Live session operations. The module refreshes every derived cache the change affects:
- the leaderboard
- the ungraded-question ids, using one rule that always excludes closest_guess (shared with the bulk refresh on entering grading statuses)
- the answered-team ids

The outcome names the question whose admin answer list must be pushed. The quiz master sees correct totals right after an auto-graded submit, and closest_guess questions never show a "not yet graded" dot. See the spec's user stories 1, 4, 5, 13–16, 21 and 31 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Regression test (real-store harness): after a team submits a correct multiple_choice answer, the next state snapshot's leaderboard shows that team's points.
- [ ] Regression test: after a closest_guess submit during question_open, the snapshot's ungraded-question ids do not include that question.
- [ ] Test: grading the last ungraded answer to a question removes it from the ungraded ids. A team changing an already-graded answer puts it back.
- [ ] The submitting team still receives its ANSWER_RECEIVED acknowledgement, and locked/hidden-question and wrong-team rejections keep today's messages.
- [ ] The admin room receives the question's answer list after every submit and grade, via the outcome.
- [ ] The submit and grade socket handlers no longer set the leaderboard, answered ids or graded status themselves.
