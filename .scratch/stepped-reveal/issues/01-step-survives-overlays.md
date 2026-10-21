# 01: A reveal's step survives the leaderboard and the join overlay

**What to build:** When the quiz master shows the leaderboard or the join overlay in the middle of a closest-guess reveal and then hides it, the reveal comes back on the same step. Today the settle step appears to restart the walk at the question (step 0). It keeps the step only for a leaderboard rank, a leaderboard hide and a join overlay hide, not for showing either overlay, or for media actions. The step should be recomputed only when the reveal on air changes: the status changes, a different reveal question lands, or the quiz ends. Every action that leaves the reveal on air keeps it. See the spec's Implementation Decisions (Settle) and Further Notes.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A real-store gateway test walks a closest-guess reveal to a middle step, shows and hides the leaderboard, and asserts that the display and players views still show the same lines. It is written first and seen failing against today's code. If it passes instead, record that under `## Comments` and narrow the ticket to the cases that do fail.
- [x] The same for showing and hiding the join overlay, and for a leaderboard rank reveal while the leaderboard is up.
- [x] Advance and Previous onto a closest-guess question still start it at step 0 (forward) and at its last step (backward). Moving to another question still resets it.
- [x] The showdown's step is unaffected (it never goes through this settle rule).
- [x] The existing closest-guess, showdown, presenter-context and action-availability gateway specs pass unchanged.
- [x] `DOCUMENTATION.md` says the reveal keeps its step through the leaderboard and the join overlay, if it describes this anywhere.
