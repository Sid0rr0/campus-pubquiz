# Spec: Split the quiz editor panel into a draft hook, an import hook and pure round edits

Status: ready-for-agent

## Problem Statement

The quiz editor panel is one 683-line view that does four unrelated jobs:

- **Draft hydration and save.** It copies a loaded draft into local state once per quiz, backfills database ids after a post-save refetch without overwriting edits, creates or updates the quiz, redirects a new quiz to its edit URL, flashes "Saved ✓", and maps a rejected save to a toast, an inline banner, per-field issues and the 409 "refresh lock state" action.
- **CSV and Google Sheets import.** It reads a file or a sheet link, decides the quiz title (the file name only when there's no title yet), replaces or adds to the draft, and writes the result as a summary toast or an issue list.
- **Round edits.** Adding, updating, deleting and moving rounds, and moving a question to another round, are written inline as state setters.
- **Live-edit frontier notes.** It works out which rounds a question may move to, and the note explaining why a round's questions are restricted while a session is live (ADR-0002).

The import form is written out twice, once for the empty state and once for the editor toolbar, with the same file input, sheet link form and pending label. A fix to one can miss the other.

The rules that matter here are hidden in the view, so they can only be tested by rendering it. The import outcome (replace or add, the title rule, the summary wording), the round moves at the ends of the list, the move targets and the frontier notes have no unit tests. They are covered only by the 1,618-line panel test. A developer changing how a live round is described has to find a switch statement in the middle of a view.

## Solution

The panel becomes a layout that composes three pieces:

- **Pure round edits and frontier notes in the draft state module.** Round add, update, delete and move, move targets, the frontier note for a round, and the import outcome become pure functions next to the existing draft conversions. They are tested with the draft state's existing tests.
- **A quiz draft hook** owns loading, hydration, the id backfill, save, the saved flash, and the save error, issues and conflict refresh. Hydration and save stay together because the backfill exists only to survive the post-save refetch.
- **A quiz import hook plus one import controls component** own the file and sheet import, the "add to quiz" choice, the pending state and the import error. The controls render the empty-state and toolbar variants from one implementation.

Nothing changes for the quiz master. The editor looks and behaves exactly as before.

## User Stories

1. As a quiz master, I want the quiz editor to look and behave exactly as before, so that this refactor never changes how I build a quiz.
2. As a quiz master, I want a new quiz to open on the empty state with Start from scratch, Import CSV and a Google Sheets link, so that I can choose how to begin.
3. As a quiz master, I want Start from scratch to give me one round called "Round 1", so that I can start typing straight away.
4. As a quiz master, I want an existing quiz to load into the editor with its title, rounds and questions, so that I can keep editing it.
5. As a quiz master, I want a load failure to show an error instead of an empty editor, so that I know the quiz didn't load.
6. As a quiz master, I want my unsaved edits kept when the editor refetches the quiz after a save, so that a second save doesn't lose what I typed.
7. As a quiz master, I want newly saved questions to pick up their database ids after a save, so that later saves update them instead of duplicating them.
8. As a quiz master, I want saving a new quiz to take me to its stable edit URL, so that a reload keeps my place.
9. As a quiz master, I want a "Saved ✓" flash and a toast after a save, so that I know it worked.
10. As a quiz master, I want a rejected save to show a toast with the issue count and a banner listing each issue by round and question, so that I can find what to fix.
11. As a quiz master, I want each issue shown next to the field it concerns, so that I can fix it in place.
12. As a quiz master, I want a live-edit conflict (409) to explain that the session moved on and offer "Refresh lock state", so that I can reload the frontier and try again.
13. As a quiz master, I want to import a CSV file into the editable draft rather than saving it straight away, so that I can review it first.
14. As a quiz master, I want to import from a pasted Google Sheets link the same way, so that I can edit a shared sheet's quiz.
15. As a quiz master, I want my first import to take its title from the CSV file name, so that a new quiz isn't left untitled.
16. As a quiz master, I want a later import to keep my existing quiz title, so that importing more questions doesn't rename my quiz.
17. As a quiz master, I want an import to replace the draft unless I tick "Add to quiz instead of replacing", so that re-importing an updated sheet is one step.
18. As a quiz master, I want an import with "add to quiz" ticked to append new rounds and merge into existing rounds with the same title, so that I can build a quiz from several sheets.
19. As a quiz master, I want a summary toast saying how many rounds and questions were imported or added, so that I can check the import worked.
20. As a quiz master, I want an import with row issues to list each one by row and field, so that I can fix the sheet or the draft.
21. As a quiz master, I want a CSV or sheet fetch error to show a message without crashing the editor, so that I can try again.
22. As a quiz master, I want the import button to show it's working while a sheet is fetched, so that I don't submit twice.
23. As a quiz master, I want the import controls on the empty state and on the editor toolbar to work the same way, so that importing behaves the same wherever I start.
24. As a quiz master, I want to add a round at the end named after its position, so that new rounds are numbered.
25. As a quiz master, I want to move a round up or down, and nothing to happen at either end of the list, so that I can reorder rounds safely.
26. As a quiz master, I want to delete a round, so that I can remove one I don't need.
27. As a quiz master, I want to move a question to another round, so that I can rebalance rounds.
28. As a quiz master, I want the move-to-round list to offer every other round that can take the question, labelled with its number and title ("Untitled round" when blank), so that I pick the right one.
29. As a quiz master, I want a live session's frozen rounds left out of the move targets, so that I can't move a question somewhere the save would refuse.
30. As a quiz master, I want a round whose opened questions are pinned to explain that the questions after them can still change, so that I know what's allowed.
31. As a quiz master, I want a round whose block has started locking to explain why and suggest a later round, so that I know where to add questions instead.
32. As a quiz master, I want a round a live session has already reached to explain that its questions can't be added, removed or reordered, so that I understand the disabled controls.
33. As a quiz master, I want no note on a round that's free to edit, so that the editor isn't cluttered.
34. As a quiz master, I want Export CSV to download the draft as it is now, unsaved edits included, and to be disabled until there's a question, so that the export matches what I see.
35. As a developer, I want round edits, move targets, frontier notes and the import outcome as pure functions with unit tests, so that I can change a rule without rendering the editor.
36. As a developer, I want the import form written once, so that a fix reaches both places it appears.
37. As a developer, I want hydration and save in one hook, so that the backfill and the save it protects are read together.
38. As a developer, I want the panel to contain only layout, so that I can find each job's code by its name.
39. As a developer, I want the existing panel tests to pass unchanged, so that they prove the split changed no behaviour.

## Implementation Decisions

- **Draft state module gains pure round edits.** Each takes the current rounds and returns new rounds, never mutating. Callers that need ids pass an id factory, as the existing draft functions do.
  - Add a round at the end, titled "Round N" for the new count.
  - Update a round by id with a partial patch.
  - Delete a round by id.
  - Move a round by id up or down one place. The rounds come back unchanged (same reference) at either end or for an unknown id.
  - Moving a question to another round already exists and stays as it is.
- **Draft state module gains frontier helpers** that read the existing round editing description (the live-edit frontier per round):
  - **Move targets:** for a given round index, every other round that can take a moved question, with its id, its label ("N. title", "Untitled round" when blank) and its kahoot flag.
  - **Structure note:** the note for a round's structure editing (none when free; the pinned-questions note when the opened questions are pinned at the start; the block-locking or reached note when frozen). The wording moves unchanged.
- **Draft state module gains the import outcome.** One pure function takes the current rounds, the current title, an import preview, whether to add to the quiz, and an id factory. It returns the new rounds, the title to use, and a result that is either a summary message or an issue message. The wording moves unchanged. A second small rule gives the title to send with a CSV import: the current title, or the file name without ".csv" when the title is blank.
- **Quiz draft hook.** It takes the quiz id ("new" or a number) and returns:
  - load state (pending and the load error)
  - the phase (empty or editor) and start from scratch
  - the title and its setter
  - the rounds and a function that applies a pure round edit to them
  - the live-edit frontier and the refresh-lock-state action
  - save and export
  - the saved flash
  - the save error message, the issues and whether the error is a live-edit conflict

  It keeps the current hydration rule (copy once per quiz id, then only backfill ids on refetch) and the current query settings.
- **Quiz import hook.** It takes what an import needs from the draft hook (the current rounds, the title and whether the editor is showing) and a callback to apply the outcome. It returns:
  - the file-chosen handler and the sheet link submit handler
  - the sheet link input and its setter
  - the "add to quiz" choice and its setter
  - whether a sheet fetch is pending
  - the import error

  It calls the import outcome rule and fires the summary toast itself.
- **Import controls component.** One component renders the file input, the sheet link form and the pending label in two variants: the empty state (large, "Paste a Google Sheets link") and the toolbar (compact, the "add to quiz" checkbox, placeholder by add or replace). Accessible names, input types and the "Importing…" and "…" pending labels stay as they are, so the existing tests still find them.
- **The panel is layout only.** It calls both hooks and renders the empty state or the editor: the toolbar, the banners, the live notice, the round list with separators, add round, and the outline. Its props don't change, and the other quiz editor components (round editor, question editor, outline) don't change.
- **ADR-0002 is respected and not reopened.** The frontier still comes from the server's draft. The helpers only describe it.
- **No backend, shared-types or API changes.**

## Testing Decisions

- **A good test asserts behaviour the quiz master or a caller can see:** for the pure functions, the rounds, title, labels and messages returned; for the panel, what's on screen and what was saved. Don't assert on hook internals, state setters or which helper was called.
- **No new seams.** Two existing seams cover this work:
  - **Draft state tests (Vitest, pure, existing).** Add cases for:
    - add round naming
    - update and delete by id
    - move up and down, including the unchanged reference at both ends and for an unknown id
    - move targets: excluding the round itself, excluding rounds that can't take a moved question, the "Untitled round" label, and no frontier meaning every other round
    - every structure note branch
    - the import outcome: replace, add with a new title, add merging by title, title kept vs taken from the preview, the summary wording for one vs many rounds and questions, and the issue message listing rows
    - the CSV title rule
  - **Quiz editor panel tests (Vitest + Testing Library, existing).** They stay unchanged and must pass at every step. They already cover hydration, the post-save refetch, create-and-redirect, the saved flash, rejected saves, the 409 refresh, every import path and error, and the live frontier controls and notes.
- **Prior art:** the existing draft state tests for pure draft functions with an injected id factory (round from preview, merge rounds from preview, synced question ids); the panel tests for the DOM.
- **No hook-level tests.** The hooks are tested through the panel, the highest seam.

## Out of Scope

- Any change to what the editor shows or does, including wording, layout and toasts.
- Changing the round editor, question editor or outline components, or their props.
- Moving rule cases out of the panel tests.
- Changing how the live-edit frontier is computed or enforced (server side, ADR-0002).
- The other candidates in the 2026-10-08 architecture review.

## Further Notes

- Source: candidate 5 of the 2026-10-08 architecture review ("Splitting the long files"), rated "Worth exploring". Expected result: the panel drops to roughly a layout's worth of lines, the duplicate import form goes, and round edits get unit tests.
- The draft state module grows from 291 lines to roughly 400. That's within the file-size guidance, and every addition is a pure draft function, so it stays one cohesive module.
- No glossary or `/guide` change is expected, since behaviour is unchanged.
