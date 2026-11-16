# 04: Callouts on the presenter remote

**What to build:** while the leaderboard is up, the presenter remote's Notes section shows the current group and the dimmed next group with their callouts, in place of question or round notes. That way the quiz master on stage doesn't need the laptop.

Spec: [../spec.md](../spec.md) (user story 29)

**Blocked by:** 03

**Status:** done

- [ ] The presenter context carries the live board (from the Rank callouts module) while the leaderboard is up.
- [ ] The Notes section draws it, including the final board and the all-at-once quickfire form.
- [ ] When the board is hidden, the Notes section shows question or round notes again as before.
- [ ] `/remote` component test.
- [ ] `/guide` text goes to ticket 06.
