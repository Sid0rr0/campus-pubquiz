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

- [ ] Postgres tests: each grading path stores the expected verdict, and a speed-scaled correct kahoot answer is stored as correct.
- [ ] Migration test: pre-existing graded rows are backfilled (≥ question points → correct, 0 → incorrect, otherwise partial). Ungraded rows stay null.
- [ ] The shared answer payload types carry the verdict, and the backend sends it on submit acknowledgement, admin answer lists and team answer sync.
- [ ] Frontend tests: /control's correct-count and /remote's correct-count count verdict-correct answers, including kahoot answers with fewer than full points.
- [ ] Overriding an answer's points in /control updates its verdict and the correct-count.
