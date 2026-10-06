# 03: Add, reorder and delete questions in rounds after the current round

**What to build:** While a quiz is live, the quiz master can use the `/quizzes/[id]` editor to add, reorder and delete questions in any round after the current round of every live session. They can also move a question from one of those rounds to another. Saving reloads every live session, and the new questions play in their new places when the quiz reaches them. Nothing at or before any session's current round can change structurally. The guard refuses such a save with a 409 that lists the issues, and the editor disables those controls.

This ticket adds the **live-edit frontier**: a description of each live session's point in the quiz (its opened questions in order, its current round, and whether its current block has started locking). It's a shared type, and one rule over it is used by both the backend guard and the editor, so the two never disagree. The editor gets the frontier in place of the bare opened question ids. Game progress stays positional; the rule works because nothing before the frontier moves (ADR 0002). The frontier is checked against the sessions' state at save time. A save made after the game has moved past an edited question is refused, and the quiz master reloads.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] In a round after every live session's current round, the editor enables adding, reordering and deleting questions, and moving a question to another such round.
- [ ] The guard accepts those saves. After the save, a live session reaching that round plays the questions in their new order, including any new ones.
- [ ] Adding, moving or deleting a question in the current round or an earlier one is still refused with a 409, and the editor keeps those controls disabled.
- [ ] With two live sessions at different points, the line is the further-on session's current round.
- [ ] A save made after a session moved into an edited round is refused with a 409 naming the conflict.
- [ ] The live-edit guard spec covers these as table cases over the frontier. The quiz editor panel tests cover which controls are enabled.
- [ ] Opened questions keep today's fix-in-place rules (type and choices frozen; prompt, answer, points, notes and media editable, with regrading).
- [ ] DOCUMENTATION.md's "Editing a live quiz" section describes the new line in place of "No structural changes".
