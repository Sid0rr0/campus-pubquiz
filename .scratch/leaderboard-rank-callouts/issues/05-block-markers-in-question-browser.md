# 05: 🏆 block markers in the question browser

**What to build:** the question browser gets a 🏆 marker after each block's break marker (after each round in a quickfire quiz). Clicking one shows only the quiz master that block's board, bottom-up, each team with its callouts, the same way clicking a question previews it.

Spec: [../spec.md](../spec.md) (user stories 20–28, 30)

**Blocked by:** 01, 04

**Status:** done

- [ ] The Rank callouts module gets a block-board entry point. A team's total is its per-round points over the rounds up to the end of that block, plus the bonus awards recorded for that block or earlier. Awards with no block count in the latest board only. Ranked by the shared ranking rule.
- [ ] A block's movement, gain and biggest gain are measured against the previous block's board. The first block has no movement lines. The existing "everyone moved up" rule applies when everyone was tied before.
- [ ] Before checking anything else, verify that a past block's rebuilt totals equal what the big screen showed after that block (speed scoring and rounding). If they don't, stop and report.
- [ ] The block in play's marker previews its board, tagged "grading not finished" while answers are ungraded. Markers for later blocks are greyed out and can't be clicked. The last block's marker shows the final board (whole-quiz lines as in 03).
- [ ] A quickfire quiz has one marker per round.
- [ ] Teams that left or were kicked appear on the boards they took part in, tagged "left".
- [ ] The marker of the board on the big screen gets the green on-air ring.
- [ ] The admin view carries the block boards for every block reached so far.
- [ ] Module tests for every rule above. `/control` component tests for marker placement, disabled later blocks, the preview tag and the card.
- [ ] `/guide` text goes to ticket 06.
