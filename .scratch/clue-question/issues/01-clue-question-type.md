# 01: Clue question type, authored and played as a typed answer

**What to build:** A quiz author can create a **Clue question** (type id `clues`, label "Clue question").

- **Editor.** Pick it in the type picker, enter 2–8 clues in a list you can reorder (no `|` in a clue) and a typed answer. The editor hides the points field for this type and shows what a right answer is worth on each clue: 0.5 × (N − k + 1) for clue k of N, so "2.5 · 2 · 1.5 · 1 · 0.5" for five clues. One shared function computes that value, and tickets 03 and 04 reuse it.
- **Points.** Points are always stored as clues × 0.5. Import and draft save both derive them through the one preview schema, whatever the sheet or form says.
- **CSV.** In the sheet, the clues go in the `options` cell, separated by `|`, and the answer in the `answer` cell. Export and import round-trip unchanged, and the import preview shows the derived points.
- **Registry.** The entry has a typed answer and the same grading mode as Free text. It is excluded from quickfire, takes no power-ups and uses the plain answer reveal. It gets a moderator note and a player note.
- **In a session**, for now, it plays like Free text and is scored at the full first-clue value. **No clue leaves the server in any view** (display, players, admin) before the reveal. Ticket 02 adds showing the clues.

Update DOCUMENTATION.md's question types and CSV sections. Any `/guide` text goes in ticket 05, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] `clues` is in the question type registry with the settings above, and the registry parity tests pass
- [ ] The preview schema refuses 1 clue, 9 clues, a clue containing `|` and an empty answer, each with a clear message
- [ ] Import and draft save store points = clues × 0.5, whatever points were given
- [ ] CSV export → import gives back the same clues, in the same order, with the same answer
- [ ] The editor shows the clue list (add, delete, reorder) and the per-clue value line, and no points field, for this type
- [ ] The clue value function returns 2.5/2/1.5/1/0.5 for 5 clues, 2/1.5/1/0.5 for 4 and 1.5/1/0.5 for 3
- [ ] A Clue question can't be added to a quickfire quiz, and the phone offers no power-ups on it
- [ ] An exact-match answer is graded correct at submit at the first-clue value, and any other answer waits for the quiz master
- [ ] No display, players or admin view carries the clues before the reveal (screen-projection test)
- [ ] DOCUMENTATION.md is updated
