# 03: Quiz draft hook: loading and saving in one place, panel becomes layout

**What to build:** Loading and saving a quiz move into one quiz draft hook, and the quiz editor panel becomes layout only (see [spec](../spec.md)). The quiz master sees no change:

- an existing quiz loads, and a missing one shows its error
- a new quiz starts on the empty state
- edits survive the refetch after a save, and saved questions pick up their ids
- saving a new quiz moves to its edit URL
- "Saved ✓" flashes
- a rejected save shows its toast, banner and per-field issues
- a 409 offers "Refresh lock state"

The hook takes the quiz id ("new" or a number) and returns:

- the load state and load error
- the phase (empty or editor) and start from scratch
- the title and its setter
- the rounds and a way to apply a pure round edit
- the live-edit frontier and the refresh action
- save, the saved flash and export
- the save error message, the issues and whether the error is a live-edit conflict

It keeps the current hydration rule (copy once per quiz id, then only backfill question ids on refetch) and the current query settings. The import hook from 02 takes its rounds, title and phase from this hook.

**Blocked by:** 01 (Pure round edits and frontier notes), 02 (The import is written once)

**Status:** ready-for-agent

- [ ] The quiz draft hook owns:
  - the draft query
  - hydration and the id backfill
  - the save mutation, the redirect, the saved flash and the save error handling
  - the refresh-lock-state action
  - export
- [ ] The panel calls the draft hook and the import hook and renders layout only:
  - the empty state or the toolbar
  - the banners and the live notice
  - the rounds with separators
  - add round and the outline

  Its props are unchanged.
- [ ] The round editor, question editor and outline components and their props are unchanged.
- [ ] The quiz editor panel tests pass unchanged, including the post-save refetch, create-and-redirect, rejected-save and 409 cases. `pnpm --filter frontend test` and `pnpm typecheck` pass.
