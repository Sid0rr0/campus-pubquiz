# 02: Rate every round on the final form

**What to build:** When the quiz reaches `ended`, and once any showdown is decided, the phone shows "Quiz complete!" followed by the final feedback form, which lists every round of the quiz with its stars. Kahoot rounds are included; this is the only place they can be rated. Stars are filled in with the team's earlier ratings and can be changed, with the same "Saved ✓" / "Not saved — tap to retry" behaviour as the break card. A team that joined late can rate every round. While a showdown is still being played at `ended`, the phones keep the showdown screens and the form waits.

The shared "open for rating" rule gains its `ended` branch (every round, unless a showdown is still being played), and the feedback field tells the phone whether it is drawing the break card or the final form. Previous out of `ended` empties the field, so the form disappears; the ratings stay, and reaching `ended` again shows the form filled in.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: at `ended` the players view's feedback field is the final form and lists every round, kahoot rounds included.
- [ ] A quiz whose block is a single kahoot round never lists that round on a break card, and does list it at `ended`.
- [ ] At `ended` with a showdown still being played the field is empty and a rating is refused; once the showdown is decided every round is listed and a rating is accepted.
- [ ] Previous out of `ended` empties the field; Advance back to `ended` lists the rounds again, and the join payload still carries the saved ratings.
- [ ] Phone: the `ended` screen shows "Quiz complete!" and the star rows filled in from saved ratings; changing one sends a rating and shows "Saved ✓".
- [ ] `DOCUMENTATION.md`'s `ended` row and feedback-field description cover the final form.
