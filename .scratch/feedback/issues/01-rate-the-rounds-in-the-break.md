# 01: Rate the rounds in the break

**What to build:** During a break (`break_intro`, `break`, and the block browser around `break_round_intro`), a team's phone shows a "Rate these rounds" card above the block browser, with a row of 1–5 stars for each round of the block that just locked. A tap saves straight away: the row shows "Saved ✓" once the server acknowledges it, or "Not saved — tap to retry" if it was refused or failed. Tapping again overwrites the rating (last write wins). Once every round on the card has a saved rating, the card collapses to "Rated ✓ · edit", which reopens it. The block browser below stays usable throughout.

The server decides which rounds are open for rating. It adds one shared rule, next to the phone-screen projection, that lists the current block's rounds in the break statuses and nothing else for now. The players view carries this as its feedback field, and the same rule decides whether a rating is accepted. Rating a round is a players-only socket event with a Zod-validated `{ roundId, stars }` and an ack. It saves one round rating per (session, round, team) and broadcasts nothing; it doesn't go through the session write. The join-accepted payload carries the team's saved round ratings, so a reconnecting phone shows its stars again.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: in `break_intro` the players view's feedback field lists the rounds of the block that just locked (id and title), and during answering and reveal it lists nothing.
- [ ] A rating for a listed round is acknowledged as ok; rating it again keeps only the last value.
- [ ] A rating for a round outside the current block, a rating during answering, and a rating outside 1–5 are refused, each with a reason in the ack.
- [ ] A reconnecting team's join-accepted payload carries its own round ratings and never another team's.
- [ ] Phone: the card shows one star row per listed round; an ok ack shows "Saved ✓", an error ack shows "Not saved — tap to retry"; the card collapses when all rows are saved and reopens on "edit"; nothing renders when the feedback field is empty.
- [ ] Phone: after a reconnect, stars come from the join payload, so a tap that never reached the server shows as empty.
- [ ] `DOCUMENTATION.md` describes the new event, the players-view feedback field and the join payload addition.
- [ ] Existing players-view and join specs pass, apart from mechanical updates for the new field.
