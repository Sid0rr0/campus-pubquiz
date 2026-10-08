# 01: The Block module, with grading asking it

**What to build:** Grading covers the **block in play** through one small rule instead of through the reveal-view function. The quiz master sees no difference:

- the closest_guess batch at the break grades the block that just locked;
- the ungraded markers and the break's ungraded reset cover that block;
- the admin can still review and grade the last block after the quiz has ended.

This ticket adds the **Block module** to the backend's live session state. It's pure, with no session, database or view types in its interface. It takes the seeded quiz's rounds and a progress, and returns the block in play as ordered positions (round index, question index) with each question's id, plus a convenience for just the ids. The rule:

- **While answering** (a question open or locking, or a round intro over already opened questions): the current block up to its furthest opened question. Previous never hides one.
- **Once the block has locked** (break, reveal and their intro cards): the whole block.
- **At `ended`:** the last block played, up to where progress stands. This is its own branch with its own comment.
- **Otherwise:** empty.

It reuses the shared block position helpers and the status groups.

Grading switches to it: the closest_guess batch, the Grading refresh's scope, the ungraded markers for the block and the break's ungraded reset ask the Block module with the progress they mean (the new progress for a press, the session's own otherwise). The two places grading builds a session copy with a swapped progress go away. Nothing else changes yet.

`GLOSSARY.md` gains **Block in play**: the questions of the current block a session has reached. While answering, it's those up to the furthest opened one; once the block locks, the whole block; at `ended`, the last block played. Grading, the answering gate and opened questions all cover the block in play.

Parent spec: `.scratch/block-membership/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Block module table tests, written first, over a quiz with two blocks (one spanning two rounds), a kahoot round and a final round:
  - every status from lobby to ended;
  - Previous stepping back inside an open block keeps the furthest opened question;
  - a round intro reached by Advance into a fresh round versus by Previous;
  - a fresh block with nothing opened;
  - `ended` after the reveal;
  - `ended` pressed mid-block after Previous, pinning today's result (up to the question on screen).
- [x] An equivalence test walks the same quiz through every status and Previous step and asserts the Block module's ids equal today's reveal-view function's ids for the same progress.
- [x] Grading no longer calls the reveal-view function or builds a session copy with a swapped progress.
- [x] The grading, grading gate, ungraded agreement, ungraded restore, last-second answer, closest_guess reveal and live-edit regrade specs pass without edits.
- [x] `GLOSSARY.md` has **Block in play**.
- [x] `pnpm --filter backend test`, `pnpm lint` and `pnpm typecheck` pass.
