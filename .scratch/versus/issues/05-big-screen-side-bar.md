# 05: Big screen: lobby counts, the leaderboard bar and row dots

**What to build:** The room sees the side contest on the big screen. The lobby shows how many teams are on each **Side**. The leaderboard shows the side bar, and each row gets its side's colour dot. During a board's rank-by-rank reveal the bar holds the previous split, then slides to the new split once the top rank is revealed (see the [spec](../spec.md)).

- **Display view:** the leaderboard board gains the current side standings, plus the prior side standings when there are **prior standings** (the module from ticket 04 run on the prior board), and each shown entry's side id. The lobby gains the team count per side. Nothing is sent with Versus off.
- **Timing:** `/display` draws the prior split while the reveal count is below the board's reveal target, and slides to the current split once it reaches it. The decision uses only what the display view carries, so a reloaded or reconnected screen draws the same thing. With no prior split (the first board, or after a backend restart) it draws the current split without a slide. The between-questions quickfire board doesn't apply: Versus is pub quiz only.
- **Final board:** same timing.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The display view carries current and prior side standings and row side ids with Versus on, and nothing with it off (gateway spec, following `leaderboard-board.spec`)
- [ ] With no prior standings the prior split is absent
- [ ] The bar shows the prior split until the top rank is revealed, then the current one; with no prior split, the current one at once (display component test, following `completion-and-leaderboard.test.tsx`)
- [ ] Each row shows its side's colour dot
- [ ] The lobby shows each side's name, colour and team count (following `lobby.test.tsx`)
- [ ] `DOCUMENTATION.md` updated for the display view fields
