# 06: Quiz edited (live answer-key fix)

**What to build:** When the quiz master corrects the answer key or points of an already-shown question during a live session, the Live session "quiz edited" operation does three things:
- reloads the questions
- regrades the affected answers
- returns an outcome naming every regraded question (fresh admin answer lists) and every connected team with an answer to one (per-team answer sync), plus a state broadcast with a fresh leaderboard

The grading panel, the big screen and the teams' phones all show the corrected points immediately. See the spec's user stories 6–8 ([spec](../spec.md)).

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Regression test (real-store harness): after correcting a shown multiple_choice question's answer, the admin room receives that question's answer list with re-scored points.
- [x] In the same scenario, each connected team that answered it receives TEAM_ANSWERS_SYNCED with its re-scored answer, and the next snapshot's leaderboard reflects the new totals.
- [x] Editing only not-yet-shown questions still just reloads and broadcasts, with no answer-list or team-sync pushes.
- [x] The accepted tradeoffs are unchanged: manual overrides are discarded on regrade, and the kahoot multipliers still live in memory.

## Comments

Implemented in the commit recorded in `.scratch/overview.md`. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state, and the overview records completion.

- `GameStateService.quizEdited(joinCode, regradeQuestionIds)` reloads the questions, regrades, and returns an outcome. `BlockGradingService.regradeQuestions` now reports which questions it actually re-scored, so the outcome's `answerListQuestionIds` names only those; `teamSyncTeamIds` is every connected team with an answer to one. `GameGateway.notifyQuizEdited` just delivers that outcome.
- Specs in `quiz-edited.spec.ts` (real-store harness). Manual-override discard and in-memory kahoot multipliers are unchanged (still pinned by `live-edit-regrade.spec.ts`).
