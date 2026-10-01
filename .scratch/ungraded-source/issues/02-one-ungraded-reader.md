# 02: One reader answers "which questions are ungraded" for the gate, the refresh and the per-answer update

**What to build:** One method in the block grading module takes the session and a set of question ids, drops those that can't be ungraded (closest_guess), asks the answer service which of the rest have an answer with no grading time, and returns the ids. The gate into reveal, the bulk refresh on entering a grading status and the per-answer update after a submit or grade all call it (the per-answer update passes just the changed question). The hand-written "any answer with no grading time" check in the answer-change path is deleted, along with the per-question patch helper if nothing else uses it. The gate still reads the database. Sites that fetch and then apply in one synchronous update stay that way. Nothing changes on stage.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The gate, the bulk refresh and the per-answer update all go through the one reader; the rule "closest_guess can't be ungraded; otherwise an answer with no grading time" is stated once
- [x] The inline `gradedAt === null` check and its per-question patch in the answer-change path are gone
- [x] No read-modify-write of the session across an `await` is introduced; the fetch-then-apply shape is kept
- [x] The agreement walk from ticket 01 and the existing `grading-gate`, `grading`, `answer-recorded-and-graded` and `admin-flags-projection` specs pass unchanged
- [x] `canBeUngraded` stays where it is

## Comments

**Implemented** (commit: see git log for "refactor(backend): one reader answers which questions are ungraded").

- `BlockGradingService.listUngradedQuestionIds(session, questionIds)` states the rule once: drop questions that fail `canBeUngraded`, then ask the answer service which of the rest have an answer with no grading time. `getUngradedBlockQuestionIds` (gate) and `refreshUngradedQuestionIds` (bulk refresh) call it, and so does `refreshAfterAnswerChange` for the single changed question.
- The `answers.some(gradedAt === null)` check and the unused `findQuestion` helper are gone. `withQuestionGradedStatus` stays: it is still the apply step that writes the reader's result for one question into the cache, so something else uses it.
- The per-answer update reads the ungraded flag in a third concurrent query beside the answer list and leaderboard, then applies everything in one synchronous `update` as before. The spec accepts that extra query.
- Backend typecheck, lint and the full Jest suite pass, including the ticket 01 agreement walk.
