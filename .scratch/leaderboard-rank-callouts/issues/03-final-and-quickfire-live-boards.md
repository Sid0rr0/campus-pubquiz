# 03: Live card on the final board and the quickfire board

**What to build:** the live leaderboard card handles the two boards that differ. The final board's callouts summarise the night. The board between quickfire questions appears all at once, so it has no current/next split.

Spec: [../spec.md](../spec.md) (user stories 18–19)

**Blocked by:** 02

**Status:** done

- [ ] Final board: perfect rounds counted over the whole quiz ("3 perfect rounds tonight"); no block-only lines (gained, block perfect rounds, biggest gain, joker); movement, gap/lead/tie and bonus kept.
- [ ] Between-questions quickfire board: the top 5 with their gains, no current/next split.
- [ ] The round-end and end-of-quiz boards of a quickfire round keep the one-by-one current/next card (they reveal one rank at a time).
- [ ] Module tests for each case, and a `/control` component test for the all-at-once form.
- [ ] `/guide` text goes to ticket 06.
