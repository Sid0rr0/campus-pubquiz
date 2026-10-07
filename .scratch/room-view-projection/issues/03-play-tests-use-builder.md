# 03: `/play` page tests use the fixture builder

**What to build:** Every page test for this role builds its view with the fixture builder from ticket 02, so it receives what the server would send for the session it describes. The phone's helper keeps building the hook result (answers, grades, ratings, the reconnect marker) but takes its snapshot from the builder and the players room. Its copied answerability rule is no longer called by any test.

This is one migrate batch of an expand–contract change (about 16 test files). The old helper still exists, so the suite stays green throughout. Tickets 03, 04 and 05 can run in parallel.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 02

**Status:** done

- [x] No test in this role's folder builds a view by hand or through the old per-role view helper.
- [x] Tests describe a quiz and a position, not a snapshot. A test that sets a field on the projected view does so for one field, with a comment saying why the real rules can't reach that state.
- [x] What each test asserts is unchanged. A test whose assertion only held because of the copied answerability rule (for example a round intro over a block the fixture made up) is corrected to what the server does, and noted in the ticket's comments.
- [x] The role's pages are not changed in this ticket. Their fallback defaults go in ticket 06.
- [x] `pnpm typecheck` and the frontend suite pass.

## Comments

Corrections where a hand-made fixture disagreed with what the server sends. The assertions themselves are unchanged unless noted.

- `rate-the-rounds`, `rate-the-rounds-final-form`, `final-feedback-comment-topics`: the old fixtures set the `feedback` field directly (round ids 11, 12, 13). The server derives it, so the tests now describe the rounds and the `collectFeedback` setting. Round ids come from the builder (1, 2, 3), so the id literals in `rateRound` expectations and `myRoundRatings` changed with them. "Feedback field is empty" became "the session does not collect feedback". The final-form fixtures also carried a `phoneScreen` field that no longer exists.
- `answered-questions` (reveal-state tests): the old fixtures showed answers in the history while the view had no reveal questions under status `break` or `reveal`. The server only attaches answers through the reveal walk (or `pastRevealedQuestions` once the block is over), and a revealing view also shows the question in the reveal panel, which duplicated the text the test looked up. The history-only tests (answers listed, match pairing) now sit after the block, in the next block's round intro, where the answers reach the phone through `pastRevealedQuestions` alone. Reveal-walk tests describe the walk (`revealIndex`) and read the same history text.
- `answered-questions`, "does not let the team jump to a question from an already-closed block": the old fixture used the lobby with a question seen earlier. The server only closes a block by moving on, so the fixture is the next block's round.
- `break-and-reveal`, "still shows the block question picker during reveal": the old fixture was status `reveal` with no reveal questions. The server always has the question at `revealIndex` revealed, so the "Revealing answers..." line only shows for a question the walk has not reached; the test now selects question 2 first, with `revealIndex` 0.
- `break-and-reveal`, the two round-title-card tests: the stale-`roundTitle` trap is now real (block of three rounds, `progress.roundIndex` pinned to the last), instead of a hand-set `roundTitle`.
- Question ids are numbers from the builder (`submitAnswer(1, ...)`, `myAnswers: { 1: ... }`), where the old fixtures used strings like `'r1q1'`. The server sends numbers.
- `pre-game-screens`, rules: `quizStructure` is derived from six four-question rounds with a break after every third, instead of being set by hand.

`apps/frontend/app/play/__tests__/test-utils.tsx`: `socketResult` takes `session` (a `SessionDescription`) and builds the snapshot with `roomView`; `seenQuestionsOf(session)` gives the hook's seen-questions map for a view. `playersView`, `progress` and the copied answerability rule are gone from this folder.

Builder change (additive, `test-utils/room-view.ts`): `closestGuessRevealStep` on the description, and a described question's `closestGuess` stats become the session's closest-guess summary for that question (the projection ignores the seeded field otherwise, so the reveal trimming could not be reached).
