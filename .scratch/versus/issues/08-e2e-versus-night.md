# 08: E2E journey: a two-side Versus night

**What to build:** A new Playwright journey, in its own spec file and following `joker-night.spec`. A session with Versus and two sides; two or more teams join and pick sides in the lobby; the quiz starts; a block is answered and graded; the leaderboard shows the side bar, and the ended screen names the winning side (see the [spec](../spec.md)). Local only, like every journey.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Teams pick sides on their phones in the lobby and the big-screen lobby shows the counts
- [ ] Start quiz is refused while a team has no side
- [ ] The phone and big-screen leaderboards show the bar with the expected split
- [ ] The ended screen names the winning side
- [ ] `pnpm e2e --repeat-each=5` on the new journey passes
