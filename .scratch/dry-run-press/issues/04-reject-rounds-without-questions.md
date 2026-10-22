# 04: Rounds without questions are not allowed

**What to build:** A live session crashes when Advance reaches a round with no questions (`getBlockInPlay` throws in the presenter preview's "next" line, and the session never moves; reproduced on main before this spec). The user's decision (2026-10-21): don't allow rounds without questions. A quiz with such a round can no longer be started as a live session (and, where the quiz is imported or saved, is rejected there with a clear error). Find the right boundary in the code; keep the change small. The Quiz preview keeps handling empty rounds as today (spec stories 7 and 8), because it is a read over unfinished quizzes.

Parent spec: `.scratch/dry-run-press/spec.md`

**Blocked by:** None

**Status:** done

- [x] A live session cannot be created or started from a quiz that has a round with no questions; the error names the round. (`GameStateService.createSession` throws `QuizHasEmptyRoundError` before any row is written; `POST /sessions` maps it to 400.)
- [x] Import/save validation rejects an empty round if that boundary exists today. It already does: `validateQuizDraft` (`apps/backend/src/quiz/quiz-draft.schema.ts`) reports "Round needs at least one question". Only quizzes already stored with an empty round reach the session boundary.
- [x] Tests cover the rejection; the Quiz preview's empty-round cases pass unchanged.
- [x] DOCUMENTATION.md says empty rounds are not allowed. The /guide page is unchanged: the editor already blocks the save, so the moderator never sees the session error in normal use.
- [x] Typecheck, lint and tests pass.
