# 02: The Settle step and the answering gate ask the Block module

**What to build:** Opened questions and whether a team may answer both come from the block in play, not from the reveal-view function. Teams and the quiz master see no difference:

- a team can answer exactly the opened questions of the current block, including across rounds inside one block, and never a kahoot question still hidden behind the leaderboard;
- Previous never takes an opened question away;
- the players view's answerability agrees with the gate, as today.

The Settle step's opened questions become the session's earlier opened questions, plus the past blocks' questions, plus the Block module's ids for the progress being moved to. Its session copy with a swapped progress goes away. The answering gate (whether the block is answerable, and whether one question is open for answering) reads membership from the Block module.

Parent spec: `.scratch/block-membership/spec.md`

**Blocked by:** 01 (The Block module, with grading asking it)

**Status:** ready-for-agent

- [ ] The Settle step and the answering gate no longer call the reveal-view function, and the Settle step builds no session copy.
- [ ] The opened questions, live structural edit, players view, kahoot answer gate, last-second answer, submit answer and commit-a-move specs pass without edits.
- [ ] The equivalence test from 01 still passes.
- [ ] `pnpm --filter backend test`, `pnpm lint` and `pnpm typecheck` pass.
