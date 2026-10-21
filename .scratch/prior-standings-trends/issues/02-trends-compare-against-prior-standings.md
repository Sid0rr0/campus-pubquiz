# 02: Trends compare against the Prior standings in every round

**What to build:** The big screen's trend arrows compare every team's rank with its rank on the **Prior standings** in every round, not only in kahoot rounds. The round back-out is deleted. What a quiz master sees change on an ordinary block:

- on the first ordinary block of the night, from everyone on 0, every team shows up;
- a bonus award given during the block (on air, in the break or during the reveal) moves the awarded team's arrow;
- a team that joined during the block has no arrow on that block's board;
- after a backend restart mid-block, that block's board has no arrows, and the next block's board has them again.

A team that kept its rank across a multi-round block still shows no movement, and kahoot rounds are unchanged.

See the spec's "Trends", "Docs" and "Testing Decisions" sections.

Parent spec: `.scratch/prior-standings-trends/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] The trend basis is always the Prior standings, ranked with the shared ranking rule. With none, no team has a trend. A team missing from them has none.
- [ ] When the Prior standings have more than one team, all tied, every shown team on them is up, in every round.
- [ ] The round back-out (the rounds of the latest scoring, each team's total with them removed) and the trend basis's "real prior board" flag are deleted. The count-up board is unchanged.
- [ ] The display view's leaderboard description keeps its shape.
- [ ] The leaderboard description real-store spec gains these ordinary-block cases:
  - all teams up from an all-tied start (replacing the case that pinned "same" for the leader and "down" for the rest);
  - a bonus in the break moves the arrow;
  - a bonus before the block doesn't;
  - Previous and Advance again keeps the earlier basis;
  - a leaderboard toggle mid-block changes nothing;
  - a late joiner has no trend;
  - a restart mid-block gives no trends on that block's board and trends again on the next.

  The existing multi-round "kept its rank shows no movement" case and every kahoot case pass unchanged.

- [ ] The prior standings real-store spec gains a case: opening the first question of a later round in the same ordinary block takes no new Prior standings, observed through the reveal board's trends.
- [ ] Docs, in the same change:
  - GLOSSARY.md's **Prior standings** says they are taken once per block (once per question in a kahoot round), kept for the rest of the block, are the only trend basis, and that a restored session has none until the next block's first question;
  - DOCUMENTATION.md's `trends` paragraph names the Prior standings as the basis in every round, keeps the all-tied rule, says there is no trend without a basis, and drops the back-out sentence.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once.
