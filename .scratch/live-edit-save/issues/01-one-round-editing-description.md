# 01: The editor and the guard read one round-editing description

**What to build:** The quiz editor offers exactly the edits the server will accept for each round of a live quiz, because both read the same description of each round. Today the editor panel, the outline and the draft state each work out from separate helpers whether a round has been reached, whether its structure is frozen, how many questions are pinned, which rounds a question can move to, and what note to show. The backend guard builds the same answers its own way.

The shared types gain one function that, given the live-edit frontier and the rounds, describes each round:

- whether a live session has reached it (it keeps its place, break-after and kahoot setting, and can't be deleted);
- its structure editing (frozen, after-opened or free);
- how many questions at its start are pinned;
- whether it can take a question moved from another round;
- why it's locked, if it is: reached, or its block has started locking.

The editor panel, the outline and the draft state read it instead of combining the separate helpers. The backend guard builds its checks on it, with its issue messages and 409 shape unchanged. The lower-level helpers stay internal to the shared types if nothing else uses them.

Parent spec: `.scratch/live-edit-save/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Table tests over frontiers (before any open, mid-round, current block locking, stepped back with Previous, two merged sessions) assert each round's reached, structure editing, pinned count, move-target eligibility and reason.
- [ ] The editor panel, outline and draft state show the same locks, notes, pinned questions and move targets as today, read from the description.
- [ ] The guard spec passes unchanged; the guard refuses exactly what it refused before.
- [ ] The quiz editor panel, outline and draft state tests pass unchanged.
