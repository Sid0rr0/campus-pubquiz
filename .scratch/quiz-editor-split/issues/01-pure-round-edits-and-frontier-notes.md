# 01: Pure round edits and frontier notes

**What to build:** Round edits and the live-edit frontier helpers move out of the quiz editor panel into the draft state module as pure functions (see [spec](../spec.md)). The panel calls them instead of its inline state setters and helpers. The quiz master sees no change: adding, renaming, deleting and moving rounds, the move-to-round list, and the notes on restricted rounds during a live session all behave exactly as before.

- **Round edits:** add a round at the end named "Round N"; update a round by id with a patch; delete a round by id; move a round up or down one place. Each takes the rounds and returns new rounds. A move at either end, or for an unknown id, returns the same rounds unchanged (same reference).
- **Move targets:** for a round index, every other round that can take a moved question, with its id, its label ("N. title", or "Untitled round" when blank) and its kahoot flag.
- **Structure note:** the note for a round's structure editing. There is none when the round is free; the pinned-questions note when opened questions are pinned at the start; the block-locking or reached note when frozen. The wording is unchanged. ADR-0002 is respected and not reopened.

**Blocked by:** None (can start immediately). It runs in parallel with 02, and whichever lands second rebases its panel edits.

**Status:** ready-for-agent

- [ ] The draft state module exports the round edits, move targets and structure note. None of them mutates its input.
- [ ] The panel's inline round setters, its move-targets helper and its structure-note helper are gone. The panel calls the module.
- [ ] Draft state tests cover:
  - add round naming
  - update and delete by id
  - move up and down, including the same reference at both ends and for an unknown id
  - move targets: excluding the round itself, excluding rounds that can't take a moved question, the "Untitled round" label, and no frontier meaning every other round
  - every structure note branch
- [ ] The quiz editor panel tests pass unchanged. `pnpm --filter frontend test` and `pnpm typecheck` pass.
