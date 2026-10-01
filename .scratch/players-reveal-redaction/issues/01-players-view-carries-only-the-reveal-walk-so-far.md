# 01: The players view carries only the reveal walk so far

**What to build:** A team's phone gets a question's correct answer only once the big screen has revealed it. Today the players room gets every answer in the block from the first `reveal_intro` card onward, and the history list shows "Correct: …" for all of them early. After this, the players view's `revealQuestions` holds only:

- the questions before `revealIndex`
- the question at `revealIndex`, once its `reveal` step is on air

The display and admin views still get the whole block. The phone drops its own reveal filter (`isDisplayRevealed` and the reveal walk it is passed) and treats any question that arrives with an answer as revealed, showing its points and verdict. When the quiz master steps back with Previous, a question the walk stepped back past arrives only as a block question again, so its answer disappears from the phone. A reconnecting phone ends up in exactly the same state.

See the spec: `.scratch/players-reveal-redaction/spec.md`, sections "Reveal redaction" and "Phone stops filtering".

**Blocked by:** None (can start immediately)

**Status:** done

- [x] At the players projection, in `reveal_intro` at the block's first position, there are no reveal questions; in `reveal` at position 0, there is one (with its answer); in `reveal` at position 2, there are three.
- [x] In `reveal_intro` crossing into a second round at position 2, there are two reveal questions, and the round title card still names the upcoming round (the On-air screen and players fields are computed before the trim).
- [x] The leaderboard covering the reveal doesn't change the trim.
- [x] The display and admin views at the same point still carry the full block.
- [x] `/play`: with a trimmed snapshot, the history list shows "Correct:" for the revealed question only, not for the block's other questions.
- [x] `/play`: after a snapshot with one fewer reveal question (Previous), that question's correct answer is no longer shown.
- [x] The phone's reveal filter is deleted; the opened-questions unit test keeps its pairing and points cases.
- [x] `DOCUMENTATION.md`'s per-room views paragraph says the players view carries only the reveal walk so far.

## Comments

The Screen projection's players case now trims `revealQuestions` to the reveal walk so far (`trimToRevealWalk` in `screen-projection.util.ts`) after the On-air screen and players-screen fields are computed from the untrimmed snapshot. The phone's `isDisplayRevealed` filter and the reveal-walk parameter of `buildOpenedQuestions` are deleted; a question counts as revealed when it arrives with an answer. The seen-questions merge needed no change: block questions are added before reveal questions, so a question the walk stepped back past arrives as a block question and overwrites its revealed copy (pinned by a new `merge-seen-questions.test.ts`). The code landed in the commit `feat(backend): the players view carries only the reveal walk so far`.
