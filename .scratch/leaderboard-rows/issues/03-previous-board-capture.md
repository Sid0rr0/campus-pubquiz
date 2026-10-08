# 03: Previous-board capture moves out of the display page

**What to build:** The rule for which board the display remembers as "the board before this update" moves from the display page into the leaderboard rows module as a pure capture function. The Kahoot between-questions animation and the trend baseline compare against that board. Given the remembered board and the latest snapshot's status, leaderboard visibility and leaderboard, it returns the board to remember. That is the snapshot's leaderboard when the status is a question-on-air status, the leaderboard is hidden, and the leaderboard is present and differs (by reference) from the remembered one. Otherwise it is the remembered board, as the same reference. The display page still holds the remembered board in state and still sets it during render, but asks the capture function what to remember. The between-questions board still opens on the pre-grading totals.

**Blocked by:** 01 (Row selection: cap, reveal walk and old-board pool). Only because 01 creates the module this goes into.

**Status:** ready-for-agent

- [ ] The leaderboard rows module exports the capture function. The display page's inline capture condition is replaced by a call to it.
- [ ] Table-driven tests cover:
  - remembers while on air and hidden
  - ignores while the leaderboard is visible
  - ignores in non-on-air statuses (for example reveal)
  - ignores an absent leaderboard
  - returns the same reference when unchanged
- [ ] The display page's completion-and-leaderboard tests pass unchanged, including the pre-grading-total regression. `pnpm --filter frontend test` and `pnpm typecheck` pass.
