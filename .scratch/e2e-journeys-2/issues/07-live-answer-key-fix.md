# 07: Live answer-key fix

**What to build:** A journey where the quiz master corrects a shown auto-graded question's answer key mid-session; the phones' reveal and the standings re-score. Also checks that `/remote`'s and `/control`'s "Waiting for grading" follows a fix that makes an answer ungraded.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] A team that was wrong becomes right after the fix, on its phone and in the standings.
- [x] Passes `--repeat-each=5`.

Journey: `e2e/tests/live-answer-key-fix.spec.ts` on `e2e/fixtures/answer-key-fix.csv`. The fix is the quiz master's `PUT /quizzes/:id` (the editor's save), sent through the admin API. "Waiting for grading" shows on `/remote` ("Up next"); `/control` marks the question "(not yet graded)" in the Grade questions browser.
