# 06: Players view: answerability and the question on screen

**What to build:** A team's phone and the server always agree on whether the current block can be answered, and the phone follows the big screen through reveal and round title cards. The players view says whether the block is answerable, using the same rule the answer-submission gate enforces: question open or locking, or a round intro with questions already open, never while a kahoot question is hidden. It also carries the question on screen during reveal and the round title during reveal intro and break round intro, taken from the named screen. /play renders from these instead of deriving them. The team's browsed question and auto-advance pin stay local page state. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** done

- [x] One function decides answerability. Both the players view and the answer-submission gate use it.
- [x] The players view carries answerability, the question on screen during reveal, and the round title during reveal intro and break round intro.
- [x] /play's own answerability, reveal-question and round-title-card derivations are deleted. It renders from the view.
- [x] Answering stays open while the leaderboard covers a question teams already saw, and when Previous steps back into a round intro whose questions are already open.
- [x] Projection tests assert answerability and the question on screen across a whole-quiz walk, including a kahoot round. The kahoot leaderboard answer-gate tests still pass.
- [x] The /play tests (question visibility, break and reveal, leaderboard overlay, auto-advance setting) pass on players view fixtures.

## Comments

Implemented in the commit adding `isBlockAnswerable` (`apps/backend/src/game/state/session-snapshot.util.ts`) and `describePlayersScreen` (`shared/types/src/on-air-screen.ts`). One function now decides answerability: the players view's `isAnswerable` and `isQuestionOpenForAnswering` (the submit gate) both read it. The players view also carries `onScreenQuestionId` (the question being revealed) and `roundTitleCard` (reveal intro and break round intro). Like the admin indicators, these read the content underneath a covering leaderboard, matching the old status-based page logic. /play dropped its `isAnswerable`, reveal-question and title-card derivations; the browsed question and auto-advance pin stay local. The phone hook result in `use-team-join` is now typed as the players view. Tests: `players-view.spec.ts` (answerability, on-screen question and title card across a whole-quiz walk, leaderboard-over-open-question, Previous into an open round intro, and kahoot hidden/shown agreeing with the gate); the existing kahoot gate specs pass; /play tests build players view fixtures through `socketResult`. Full backend, frontend and shared-types suites, lint and tsc pass. Status set to `done`.
