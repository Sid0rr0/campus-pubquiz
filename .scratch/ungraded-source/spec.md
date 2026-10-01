# Spec: One rule and one reader for "which questions are still ungraded"

Status: ready-for-agent

Blocked by: session-settle ticket 03 for ticket 03 of this feature only (restore is rewritten there). Tickets 01, 02 and 04 can start immediately. Session-settle ticket 01 (named status groups) replaces the grading and graded status lists this spec leaves alone, so it can land before or after.

## Problem Statement

During a break the quiz master grades the answers teams gave in the block. The admin view and the Advance gate both depend on one question: **which questions in this block still have ungraded answers?** That answer is worked out in three places that don't share code:

- **The gate into reveal.** Before Advance leaves the break for the reveal, the Live session module asks the database directly (`getUngradedBlockQuestionIds`) and rejects with the list if anything is ungraded. This one is authoritative.
- **The bulk refresh.** When the block enters a grading status, `refreshUngradedQuestionIds` asks the same database question again and stores the result in the session's `ungradedQuestionIds`, which is sent to `/control` and read by showdown eligibility.
- **The per-answer patch.** After every answer submitted or graded, `refreshAfterAnswerChange` fetches that question's answers, decides in plain TypeScript whether any has no grading time (`gradedAt === null`) and the question can be graded by hand, and patches the cache for that one question.

Two of these are the same query; the third restates its rule (an answer is ungraded when it has no grading time, on a question a person can grade) in different code. Nothing checks they agree. And one situation exposes the gap: the session's `ungradedQuestionIds` is **never refreshed when sessions are restored after a restart**. A backend that restarts mid-break comes back with the cache empty, so `/control` shows no ungraded markers, showdown eligibility ignores unfinished grading, and the quiz master only finds out when Advance is rejected by the database gate.

A smaller echo of the same shape: the three grading stages inside `BlockGradingService` (closest_guess batch, kahoot speed scoring, answer-key regrade) each end with their own copy of "fetch the leaderboard, put it on the session".

## Solution

**One reader.** One method in the block grading module reports which of a given set of questions have ungraded answers. It applies the rule that closest_guess can never be ungraded, then asks the database. Everything that needs the answer calls it:

- the gate into reveal passes the block's questions
- the bulk refresh passes the block's questions
- the per-answer update passes just the question that changed

The hand-written "any answer with no grading time" check in the answer-change path is deleted, and so is its per-question patch helper once nothing else needs it.

**Restore refreshes it.** When a session is restored after a restart, the same reader fills `ungradedQuestionIds` for the restored progress, so the admin view and showdown eligibility are right immediately.

**One standings step inside grading.** The three grading stages share one small step that fetches the leaderboard and returns the session with it applied.

Nothing changes on stage, on the phones or in the socket contract, apart from the restart case now being right.

## User Stories

1. As a quiz master grading a break, I want a question's "needs grading" marker to appear when a team's answer to it needs me and disappear when I've graded the last one, as today.
2. As a quiz master, I want closest_guess questions never to show as needing grading, as today.
3. As a quiz master, I want Advance out of the break to be refused with the list of ungraded questions until they're graded, as today.
4. As a quiz master whose backend restarts in the middle of a break, I want `/control` to show the right ungraded markers straight away, so that I'm not surprised by a refused Advance.
5. As a quiz master whose backend restarts in the middle of the last break, I want the showdown option to be offered only when nothing is left ungraded.
6. As a quiz master, I want a team revising a free-text answer during a break to put that question back on the ungraded list, as today.
7. As a quiz master running a kahoot round, I want speed-scored points and the leaderboard to be as fresh as today after the lock.
8. As a developer, I want the rule for "ungraded" written once, so that changing what counts (say, a new question type that can't be hand-graded) is a single edit.
9. As a developer, I want the gate, the bulk refresh, the per-answer update and the restore to read the same answer, so that they can never disagree.
10. As a developer, I want one test that walks a block through every event that changes grading and asserts the admin view's ungraded set equals the database's, so that a future change can't desynchronize them.

## Implementation Decisions

- **The reader lives in the block grading module.** It takes the session and the question ids to check, drops those that can't be ungraded (closest_guess, via `canBeUngraded`), asks the answer service which of the rest have an answer with no grading time, and returns the ids. Both existing entry points (`getUngradedBlockQuestionIds` for the gate and `refreshUngradedQuestionIds` for the bulk refresh) become thin callers of it.
- **Per-answer update uses the reader for the changed question.** `refreshAfterAnswerChange` keeps its existing fetch of the question's answers for the answered-team list, but derives "ungraded" from the reader rather than from `answers.some(gradedAt === null)`. One extra indexed query per answer change at pub-quiz scale is acceptable; if the implementer prefers to derive it from the answers already loaded, the rule must still be stated once and shared with the database query.
- **Keep fetch-then-apply.** Sites that fetch standings or ungraded ids and then apply them in one synchronous update (the pattern in `teamRemoved`, `bonusChanged`, `refreshAfterAnswerChange`) must stay that way. Don't turn them into read-modify-write on the session across an `await`: another event could update the session in between and the write would clobber it.
- **Restore.** After the session is built from saved progress, the reader fills `ungradedQuestionIds` for the restored progress, only when the restored status is one where the cache is trusted (the existing grading statuses). Outside them the cache keeps its current meaning.
- **Standings step inside grading.** `ensureBlockGraded`, `ensureKahootSpeedScored` and `regradeQuestions` end through one private step that fetches the leaderboard and returns the session with it. The standings fetches elsewhere in the Live session module (team removed, bonus changed, answer change) are **not** merged into it: they follow fetch-then-apply and have no stage-shaped session to return.
- **Status lists stay as they are.** The grading and graded status lists in the block grading module are replaced by named groups in session-settle ticket 01; this feature doesn't touch them.
- **Where `canBeUngraded` lives** is unchanged here. It's per-question-type knowledge and moves into the question kind registry when question-kind-module ticket 05 lands.
- **The gate into reveal still reads the database directly** (that behaviour is its whole point); it just goes through the shared reader.

## Testing Decisions

- **A good test drives the game through the real-store gateway harness and asserts what the admin sees and what Advance does.** It doesn't assert which method computed the list.
- **Seam 1: an agreement walk.** One scenario steps a block through every event that changes grading and, after each, asserts the admin view's `ungradedQuestionIds` equals the set a fresh database read says. Events: answer submitted (each human-gradable type), answer revised, answer graded, question locked, break entered, block batch-graded (closest_guess), live answer-key fix, team kicked. It also asserts closest_guess never appears. Ticket 01 writes this against today's code, so it is the safety net for ticket 02.
- **Seam 2: the existing specs pass unchanged.** `grading-gate`, `grading`, `answer-recorded-and-graded`, `admin-flags-projection` and the `/control` grading-question-browsing test already pin the gate, markers and projection.
- **New case:** restart mid-break with an ungraded human-gradable answer. Right after restore the admin view lists the question as ungraded, and showdown eligibility is false on the last block. Prior art: the harness's restart helper and the existing "still auto-advances to break after a backend restart mid-countdown" case.
- **Standings:** existing leaderboard and kahoot-scoring specs cover the freshness behaviour of the three stages; no new seam is needed for ticket 04.

## Out of Scope

- **Merging `AnswerService` grading into the block grading module** (four lifecycle entry points returning patch + standings + sync set). Considered and deferred: a larger move that is best done after session-settle, whose effect list would be its natural shape.
- **Merging the standings fetches outside the grading stages** (team removed, bonus changed, answer change, create/restore). They're safe as fetch-then-apply and a shared helper would invite the race described above.
- **Whether a kahoot team sees full points before the speed rescale.** On-stage behaviour is unchanged here.
- **Per-answer "graded by" attribution.** Accepted tradeoff in the project guide.
- **Named status groups, the settle step, per-type knowledge.** session-settle and question-kind-module.

## Further Notes

- This was candidate 04 in the architecture review. The review proposed four lifecycle entry points; exploring it showed the real duplication is the rule and the cache, so the scope was cut to the reader, the restore fix and the grading-stage standings step.
- "Ungraded" and "needs grading" are used interchangeably in the UI. Prefer **ungraded** in code and add it to CONTEXT.md when this lands.
