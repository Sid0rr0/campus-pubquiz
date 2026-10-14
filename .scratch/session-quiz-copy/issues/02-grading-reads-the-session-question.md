# 02: Submit and hand grading grade against the session's question

Status: done

Blocked by: 01

Spec: [Every session holds the current quiz, and grading reads only that copy](../spec.md)

**What to build:** Submitting an answer and grading one by hand both use the question as the session holds it, the same copy that lock-time grading, kahoot speed scoring and key fixes already use. The Answer module stops reading the question table. It grades stored answers against a question it is given. Grades, verdicts and refusals are exactly as today.

- **Submit** in the Answer module takes the session's gradable question (the shape lock-time grading takes) instead of a question id to look up. It no longer re-reads the question row or rebuilds an Answer key from it.
- **The answers change module** finds that question in the session's block in play, the same lookup the answering gate already makes, and passes it in. A question the session doesn't hold is still refused at the gate.
- **Hand grading:** the answers change module learns the answer's question id, looks up the session's question for it and passes it to the Answer module.
  - The Grading policy's "can this be graded by hand yet" check and the manual verdict use that question.
  - An answer whose question isn't in the session's quiz is refused, like an unknown answer today.
  - Either split hand grading into "which question is this answer to" and "grade this answer against this question", or pass a lookup over the session's questions. Pick whichever keeps the Answer module's interface smallest.
- The Answer module drops its dependency on the question table. Answer rows still reference questions by id; no schema change.
- Adapt the Answer module's specs and test utilities. Submit and hand grade are given the question instead of seeding a question row for a lookup. Keep every Grading policy assertion (keep, clear and set on submit; the can-grade-by-hand refusal; the manual verdict).

## Acceptance criteria

- [ ] The Answer module has no dependency on the question table, and submit makes no question lookup
- [ ] Submit, hand grade, lock-time grading, kahoot speed scoring and key fixes all grade against the session's question
- [ ] A hand grade of an answer to a question the session doesn't hold is refused
- [ ] The Answer module's grading, submit-and-list and auto-grading specs pass with the question passed in
- [ ] The game-level submit-answer, answer-recorded-and-graded, grading-gate, grading, kahoot answer speed, last-second answer and live-edit-regrade specs pass unchanged
- [ ] `pnpm typecheck` and `pnpm test` pass
