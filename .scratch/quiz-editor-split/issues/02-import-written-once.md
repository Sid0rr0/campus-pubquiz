# 02: The import is written once: import outcome, import hook and import controls

**What to build:** CSV and Google Sheets import is implemented once (see [spec](../spec.md)). The quiz master sees no change: importing from the empty state or the editor toolbar replaces the draft, or adds to it when "Add to quiz instead of replacing" is ticked. The first import takes its title from the file name. Imports show the same summary toast or issue list, and errors show the same messages.

- **Import outcome (pure, draft state module).** It takes the current rounds, the current title, an import preview, whether to add to the quiz, and an id factory. It returns the new rounds, the title to use, and either a summary message or an issue message. The wording is unchanged.
- **CSV title rule (pure).** It returns the current title, or the file name without ".csv" when the title is blank.
- **Import hook.** It owns the file-chosen and sheet-link-submit handlers, the sheet link input, the "add to quiz" choice, the pending state and the import error. It applies the outcome through a callback from the panel and fires the summary toast itself.
- **Import controls component.** It renders the file input, the sheet link form and the pending label in an empty-state variant and a toolbar variant. The toolbar variant includes the "add to quiz" checkbox and picks its placeholder by add or replace. The accessible names, input types and pending labels ("Importing…", "…") are unchanged.

**Blocked by:** None (can start immediately). It runs in parallel with 01, and whichever lands second rebases its panel edits.

**Status:** ready-for-agent

- [ ] The draft state module exports the import outcome and the CSV title rule.
- [ ] The panel no longer contains import state, import mutations or either copy of the import form. It renders the import controls in both places.
- [ ] Draft state tests cover:
  - replace
  - add with a new round title
  - add merging into a round with the same title
  - title kept vs taken from the preview
  - summary wording for one vs many rounds and questions, for replace and for add
  - the issue message listing each row and field
  - the CSV title rule with and without an existing title
- [ ] The quiz editor panel tests pass unchanged, including every import path and error. `pnpm --filter frontend test` and `pnpm typecheck` pass.
