# 06: Players view: answerability and the question on screen

**What to build:** A team's phone and the server always agree on whether the current block can be answered, and the phone follows the big screen through reveal and round title cards. The players view says whether the block is answerable, using the same rule the answer-submission gate enforces: question open or locking, or a round intro with questions already open, never while a kahoot question is hidden. It also carries the question on screen during reveal and the round title during reveal intro and break round intro, taken from the named screen. /play renders from these instead of deriving them. The team's browsed question and auto-advance pin stay local page state. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] One function decides answerability. Both the players view and the answer-submission gate use it.
- [ ] The players view carries answerability, the question on screen during reveal, and the round title during reveal intro and break round intro.
- [ ] /play's own answerability, reveal-question and round-title-card derivations are deleted. It renders from the view.
- [ ] Answering stays open while the leaderboard covers a question teams already saw, and when Previous steps back into a round intro whose questions are already open.
- [ ] Projection tests assert answerability and the question on screen across a whole-quiz walk, including a kahoot round. The kahoot leaderboard answer-gate tests still pass.
- [ ] The /play tests (question visibility, break and reveal, leaderboard overlay, auto-advance setting) pass on players view fixtures.
