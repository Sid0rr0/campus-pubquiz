# 02: Live leaderboard card on /control

**What to build:** while the leaderboard is up on the big screen, the admin console's detail column shows a leaderboard card. It shows the rank group the latest Advance revealed, large, and the group the next Advance will reveal, dimmed. Each team in both groups has its **Rank callout**.

Spec: [../spec.md](../spec.md) (user stories 1–17, 31)

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] A new pure Rank callouts module in shared types with a live-board entry point. Given the session, it returns the current group (or none), the next group (or none), and each team's callouts. It uses the same reveal count and tie grouping as the big screen.
- [ ] The callouts: named perfect rounds of the block just scored; points gained in it; rank movement (up from / down from / holds); joker 2× on a round of the block; bonus and penalty; gap to the group above, "leads by N", or "shares the lead"; tied teams named; biggest gain of the block (ties included, none when nobody gained).
- [ ] Before the first Advance only a next group; after the winner only a current group.
- [ ] The admin view carries the live board while the leaderboard is up. No other room is sent callouts.
- [ ] The detail column switches to the card when the board goes up, under the existing rule: a question you clicked stays put until the big screen reaches it.
- [ ] Module tests against plain session fixtures (prior art: leaderboard-board, fun-facts, perfect-rounds, leaderboard-reveal tests): reveal count 0, mid-reveal and fully revealed, ties, each callout line.
- [ ] `/control` component test: card shown while the board is up, current large, next dimmed, a manual pick kept.
- [ ] `DOCUMENTATION.md` admin-view section is left to ticket 06. `/guide` text goes to ticket 06.
