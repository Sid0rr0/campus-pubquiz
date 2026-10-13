# 02: Editable margin in the quiz editor

**What to build:** A quiz author can set a Number question's **margin** in the quiz editor, and only there. When the type is Number, the editor shows a margin row next to the answer field: a number field plus a **% / absolute** toggle, with 10% for new questions. Decimals are allowed, and 0 means only the exact key is correct. The margin is saved with the question, loaded back into the editor, and used by grading. Switching a question from Free text to Number keeps its prompt, and keeps its answer if that's a number. Changing the margin of an opened question during a live session re-scores its answers like a key fix, which discards manual overrides.

CSV has no margin column, the same as match's scoring mode. An imported Number question gets 10%, and a custom margin is lost on export → re-import.

**Blocked by:** 01 (Number question type with a fixed 10% margin)

**Status:** done

- [ ] Grading uses the stored margin. For an absolute margin, allowed = value. For a percentage, allowed = |key| × value / 100. Both edges count.
- [ ] The Number preview schema rejects a negative margin value and a percentage over 100, with issues on the margin field that the editor shows.
- [ ] The editor shows the margin row only for Number. A new Number question starts at 10%, and the toggle switches between % and absolute.
- [ ] With a key of 0 and a percentage margin, the editor shows an advisory hint suggesting an absolute margin. It's not a validation error.
- [ ] Switching Free text → Number keeps the prompt, and keeps the answer if it parses as a number (otherwise the answer is cleared).
- [ ] The margin survives save → reload of the quiz.
- [ ] The live-edit guard treats the margin as a grading input, so changing it on an opened question re-scores that question's answers and drops a manual override (Postgres integration spec).
- [ ] CSV import fills in the 10% default, and export writes no margin. DOCUMENTATION.md's CSV section says so.
- [ ] The `/guide` page describes the margin controls.
