# 01: Row selection: cap, reveal walk and old-board pool

**What to build:** Create the leaderboard rows module (see [spec](../spec.md)) with a pure row selection function. Given the current entries, optional previous entries, optional reveal count, optional cap and the animation phase (`old`, `counting`, `settled`), it returns the rows to show, in order, each with the entry to draw, its 0-based rank index and its rank label. The leaderboard view renders its rows from this function instead of building them itself. It still works out trend itself for now (moved in 02). The big-screen leaderboard looks and animates exactly as before.

Rules it owns, each unchanged from today:

- The cap takes the first N entries by final standing and splits a tie at the cutoff.
- The reveal walk counts whole rank groups bottom-up inside the capped pool, clamped to between 0 and the group count, and does not apply while the old board is animating.
- The old pool is capped by final standing, holds each team's old value (0 for a newcomer), and is ranked with the shared ranking rule. An empty previous board stands in as the full roster at 0. `old` draws the old entry and `counting` draws the new entry, both in old order. `settled` draws entries in their own order.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The leaderboard rows module exports row selection. It imports no React, motion or timers.
- [ ] The input type carries the documentation that today sits on the leaderboard's props for these inputs, and the props refer to it. The props themselves are unchanged.
- [ ] The leaderboard view gets its rows only from row selection. Its own cap, pool and reveal-walk helpers are deleted.
- [ ] Table-driven Vitest tests for row selection cover:
  - reveal count omitted, 0, 1, growing and over the count
  - labels relative to the full standings
  - ties sharing a label
  - cap, cap omitted, cap splitting a tie, and the capped walk reaching rank 1
  - old and counting rows holding old order with old then new totals, and settled rows reordering
  - an empty previous board at 0, capped
  - the old pool chosen by final standing when the old board had no ties
- [ ] The matching rule cases are removed from the leaderboard DOM tests once their table-driven versions pass.
- [ ] The display page's leaderboard tests pass unchanged. `pnpm --filter frontend test` and `pnpm typecheck` pass.
