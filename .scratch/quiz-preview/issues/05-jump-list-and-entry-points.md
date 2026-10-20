# 05: Jump list, position in the URL, and the other entry points

Status: done

Spec: [Quiz preview](../spec.md)

**What to build:** The quiz master jumps straight to any round or question from a side list next to the frame, and their position is kept in the URL (`?at=`, naming the round and question), so a refresh or a shared link opens the same screen. The preview opens from more places:

- "Preview from here" on each question in the quiz editor, opening at that question (with the same unsaved-changes prompt as ticket 03);
- a Preview action on each row of the quiz list;
- a Preview action on each session waiting in the lobby on `/sessions`, opening that session's quiz.

The `/guide` page tells moderators to check a quiz's content with Quiz preview rather than a throwaway session.

**Blocked by:** 04.

- [ ] Page tests: the jump list lists rounds and questions and moves to the chosen one; `?at=` is read on load (both modes; an unknown position falls back to the first step) and kept up to date while stepping.
- [ ] Editor test: "Preview from here" opens the preview at that question.
- [ ] Quiz list and `/sessions` tests: the Preview action links to the quiz's preview; on `/sessions` only lobby sessions show it.
- [ ] `/guide` updated.
