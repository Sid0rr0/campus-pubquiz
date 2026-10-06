# 03: Add, reorder and delete questions in rounds after the current round

**What to build:** While a quiz is live, the quiz master can use the `/quizzes/[id]` editor to add, reorder and delete questions in any round after the current round of every live session. They can also move a question from one of those rounds to another. Saving reloads every live session, and the new questions play in their new places when the quiz reaches them. Nothing at or before any session's current round can change structurally. The guard refuses such a save with a 409 that lists the issues, and the editor disables those controls.

This ticket adds the **live-edit frontier**: a description of each live session's point in the quiz (its opened questions in order, its current round, and whether its current block has started locking). It's a shared type, and one rule over it is used by both the backend guard and the editor, so the two never disagree. The editor gets the frontier in place of the bare opened question ids. Game progress stays positional; the rule works because nothing before the frontier moves (ADR 0002). The frontier is checked against the sessions' state at save time. A save made after the game has moved past an edited question is refused, and the quiz master reloads.

**Blocked by:** 01

**Status:** done

- [x] In a round after every live session's current round, the editor enables adding, reordering and deleting questions, and moving a question to another such round.
- [x] The guard accepts those saves. After the save, a live session reaching that round plays the questions in their new order, including any new ones.
- [x] Adding, moving or deleting a question in the current round or an earlier one is still refused with a 409, and the editor keeps those controls disabled.
- [x] With two live sessions at different points, the line is the further-on session's current round.
- [x] A save made after a session moved into an edited round is refused with a 409 naming the conflict.
- [x] The live-edit guard spec covers these as table cases over the frontier. The quiz editor panel tests cover which controls are enabled.
- [x] Opened questions keep today's fix-in-place rules (type and choices frozen; prompt, answer, points, notes and media editable, with regrading).
- [x] DOCUMENTATION.md's "Editing a live quiz" section describes the new line in place of "No structural changes".

## Comments

Implemented in a single commit (see git history for the hash). The frontier is `LiveEditFrontier` in `shared/types/src/live-edit-frontier.ts` (opened question ids + current round index), merged across live sessions by `mergeLiveEditFrontiers` (the line is the furthest-on session's round) and read by both the backend guard and the editor through `isRoundStructureFrozen`. `GameStateService.getLiveEditFrontier` builds each session's frontier; its current round never falls behind the furthest opened question, so Previous stepping back can't unfreeze a round with opened questions in it. `findLiveEditViolations` now takes the frontier and only checks question structure in rounds up to the line; a save into a round a session has since reached is refused with a message saying it has been reached. `GET /quizzes/:id` returns the frontier as `liveEdit`. The editor had no way to move a question between rounds, so this adds a "Move to…" select on each question (`moveQuestionToRound` in `quiz-draft-state.ts`); add/delete/reorder/move are disabled only in frozen rounds, and the outline's question drag follows the same rule. Round-level controls stay disabled while live (ticket 05). The frontier does not carry the "current block has started locking" flag yet: nothing reads it until ticket 04, which should add it. Tests: `live-edit-guard.spec.ts` (table cases over the frontier), `live-edit-frontier.test.ts`, `quiz.controller.spec.ts`, `opened-questions.spec.ts`, and the editor panel, outline and draft-state tests. `CONTEXT.md` and `DOCUMENTATION.md` updated.
