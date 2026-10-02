# 02: Rate every round on the final form

**What to build:** When the quiz reaches `ended`, and once any showdown is decided, the phone shows "Quiz complete!" followed by the final feedback form, which lists every round of the quiz with its stars. Kahoot rounds are included; this is the only place they can be rated. Stars are filled in with the team's earlier ratings and can be changed, with the same "Saved ✓" / "Not saved — tap to retry" behaviour as the break card. A team that joined late can rate every round. While a showdown is still being played at `ended`, the phones keep the showdown screens and the form waits.

The shared "open for rating" rule gains its `ended` branch (every round, unless a showdown is still being played), and the feedback field tells the phone whether it is drawing the break card or the final form. Previous out of `ended` empties the field, so the form disappears; the ratings stay, and reaching `ended` again shows the form filled in.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Written first, failing against today's code: at `ended` the players view's feedback field is the final form and lists every round, kahoot rounds included.
- [x] A quiz whose block is a single kahoot round never lists that round on a break card, and does list it at `ended`.
- [x] At `ended` with a showdown still being played the field is empty and a rating is refused; once the showdown is decided every round is listed and a rating is accepted.
- [x] Previous out of `ended` empties the field; Advance back to `ended` lists the rounds again, and the join payload still carries the saved ratings.
- [x] Phone: the `ended` screen shows "Quiz complete!" and the star rows filled in from saved ratings; changing one sends a rating and shows "Saved ✓".
- [x] `DOCUMENTATION.md`'s `ended` row and feedback-field description cover the final form.

## Comments

Implemented in a single commit, `feat: rate every round on the final form` (find it with `git log --grep "rate every round on the final form"`; the hash isn't known until the commit exists).

- The rule is still `describeFeedback` in `shared/types/src/on-air-screen.ts`; `FeedbackField.kind` is now `'break_card' | 'final_form'`. The backend passes it `isShowdownBeingPlayed` (a showdown round exists and isn't `resolved`) and `allRounds` via `getFeedbackField`, so the projection and `RATE_ROUND` still share one rule.
- Phone: the star rows and their saved/failed state moved into `round-star-rows.tsx` (`useRoundRatings`, `RoundStarRows`), shared by `RoundRatingCard` and the new `FinalFeedbackForm`, which `/play` draws under the phone screen whenever the field is `final_form`. After a decided showdown the phone is still on the showdown reveal screen (the screen projection is unchanged), so the form appears under that rather than under "Quiz complete!".
- A tied quiz ends with the form open until the moderator creates the showdown round; creating it withdraws the form and refuses further ratings (saved ratings stay). That follows from "while a showdown is still being played".
- `DOCUMENTATION.md` was updated, but its hunks went in with the stats ticket's commit (`38cbbb2`), made from the same working tree.
- Specs: `rate-round.spec.ts` (final-form section, real database) and `rate-the-rounds-final-form.test.tsx`. Full suites, lint and build pass.
