# 01: Rate the rounds in the break

**What to build:** During a break (`break_intro`, `break`, and the block browser around `break_round_intro`), a team's phone shows a "Rate these rounds" card above the block browser, with a row of 1–5 stars for each round of the block that just locked. A tap saves straight away: the row shows "Saved ✓" once the server acknowledges it, or "Not saved — tap to retry" if it was refused or failed. Tapping again overwrites the rating (last write wins). Once every round on the card has a saved rating, the card collapses to "Rated ✓ · edit", which reopens it. The block browser below stays usable throughout.

The server decides which rounds are open for rating. It adds one shared rule, next to the phone-screen projection, that lists the current block's rounds in the break statuses and nothing else for now. The players view carries this as its feedback field, and the same rule decides whether a rating is accepted. Rating a round is a players-only socket event with a Zod-validated `{ roundId, stars }` and an ack. It saves one round rating per (session, round, team) and broadcasts nothing; it doesn't go through the session write. The join-accepted payload carries the team's saved round ratings, so a reconnecting phone shows its stars again.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Written first, failing against today's code: in `break_intro` the players view's feedback field lists the rounds of the block that just locked (id and title), and during answering and reveal it lists nothing.
- [x] A rating for a listed round is acknowledged as ok; rating it again keeps only the last value.
- [x] A rating for a round outside the current block, a rating during answering, and a rating outside 1–5 are refused, each with a reason in the ack.
- [x] A reconnecting team's join-accepted payload carries its own round ratings and never another team's.
- [x] Phone: the card shows one star row per listed round; an ok ack shows "Saved ✓", an error ack shows "Not saved — tap to retry"; the card collapses when all rows are saved and reopens on "edit"; nothing renders when the feedback field is empty.
- [x] Phone: after a reconnect, stars come from the join payload, so a tap that never reached the server shows as empty.
- [x] `DOCUMENTATION.md` describes the new event, the players-view feedback field and the join payload addition.
- [x] Existing players-view and join specs pass, apart from mechanical updates for the new field.

## Comments

Implemented in a single commit, `feat(backend): rate the rounds in the break` (find it with `git log --grep "rate the rounds in the break"`; the hash isn't known until the commit exists).

- The rule is `describeFeedback` in `shared/types/src/on-air-screen.ts`, next to the phone-screen projection. The backend builds the players view's `feedback` field from it and the `RATE_ROUND` handler checks a rating against it, both through `getFeedbackField` (`game/state/feedback-rounds.util.ts`).
- Field shape: `feedback: { kind: 'break_card', rounds: [{ id, title }] } | null`; `kind` leaves room for the final form in ticket 02.
- Ratings live in a new `round_ratings` table (migration `Migration20261002120000_AddRoundRatings`), unique per (session, round, team), saved with an upsert by `FeedbackService`.
- On the phone, `RoundRatingCard` owns the "Saved ✓" / "Not saved — tap to retry" / "Rated ✓ · edit" states. The page remounts it on each join payload (`roundRatingsEpoch`), so a tap whose ack never arrived shows empty after a reconnect.
- Specs: `rate-round.spec.ts` (backend, real database), `rate-the-rounds.test.tsx` and `use-player-game.test.ts` (frontend). Full suites pass; one unrelated frontend test (`use-team-join-real-socket`) failed once under load and passed on rerun and in isolation.
