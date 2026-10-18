# 02: Show the round note on the big screen

**What to build:** A round's "show on screen" setting. When it's on and the note isn't empty, the big screen draws the round note on the round intro and break round intro, under the title, category and author. Phones never get it.

- `Round.showNoteOnScreen` (`boolean`, default `false`), with a migration. `QuizDraft` rounds get an optional `showNoteOnScreen`, copied by `findDraftById` and save, and seeded onto `SeededRound`. Live-editable on every round. `findLiveEditViolations` ignores it.
- The display view carries the round note only for the round title card on air, only on the round intro or break round intro, and only when the setting is on and the note is non-empty. The players view never carries it.
- `round-title-card.tsx` draws it as text (`whitespace-pre-line`) under title, category and author. It follows the display text scale.
- Editor: a "Show on screen" checkbox next to the note, off by default and disabled while the note is blank.
- Docs: DOCUMENTATION.md (the round intro on the big screen). `/guide`: the checkbox, and that the note never shows on phones or at reveal.

See the spec's "Host-only by default", "Where it shows", "Big screen" and "Editor" decisions.

**Blocked by:** 01

**Status:** done

- [ ] Backend spec: with the setting off, the display view has no note. With it on, the display view has it and the players view doesn't. On the reveal intro, no view has it. With the setting on and an empty note, no view has it.
- [ ] Backend spec: turning the setting on live, while that round's intro is on air, updates the display view.
- [ ] `/display` test: the round title card draws the note when the view carries it and nothing extra when it doesn't.
- [ ] Editor test: the checkbox is disabled while the note is blank, and off by default.
- [ ] `pnpm typecheck`, `pnpm lint`, and the backend/frontend/shared-types tests pass.
