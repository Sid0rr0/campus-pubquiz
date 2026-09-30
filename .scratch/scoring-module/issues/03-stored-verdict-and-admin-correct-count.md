# 03: Stored verdict and verdict-based correct-count on /control and /remote

**What to build:** Every answer stores a verdict (correct, partial, incorrect; null while ungraded), written together with points on every grading path:
- auto-grading at submit
- kahoot speed scoring (speed never changes the verdict)
- regrade
- closest_guess batch
- manual grading, where full points means correct, zero means incorrect, and anything between means partial

A migration backfills graded historical answers from their points. The submit acknowledgement, the admin answer list and the per-team answer sync carry the verdict. /control's grading panel and /remote count correct answers by verdict, so a room of teams who all got a kahoot question right shows them all as correct. See [spec](../spec.md) user stories 1–5.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Postgres tests: each grading path stores the expected verdict, and a speed-scaled correct kahoot answer is stored as correct.
- [x] Migration test: pre-existing graded rows are backfilled (≥ question points → correct, 0 → incorrect, otherwise partial). Ungraded rows stay null.
- [x] The shared answer payload types carry the verdict, and the backend sends it on submit acknowledgement, admin answer lists and team answer sync.
- [x] Frontend tests: /control's correct-count and /remote's correct-count count verdict-correct answers, including kahoot answers with fewer than full points.
- [x] Overriding an answer's points in /control updates its verdict and the correct-count.

## Comments

Implemented in `feat(backend,frontend,shared-types): store answer verdicts and count correct by verdict`. Status line left as `ready-for-agent`; the triage vocabulary has no done state.

- Migration `Migration20260930120000_AddVerdictToAnswers` adds a nullable text column and backfills graded rows (zero → incorrect, ≥ question points → correct, else partial). Covered by `src/db/__tests__/answer-verdict-backfill.spec.ts`.
- `verdict` is now on `AnswerView`, `TeamAnswerView` and `AnswerReceivedPayload`. The team phones don't read it yet (ticket 05); stats still read points (ticket 04).
- Overriding points in /control goes through `AnswerService.grade`, which recomputes the verdict, and the refreshed admin answer list carries it.
