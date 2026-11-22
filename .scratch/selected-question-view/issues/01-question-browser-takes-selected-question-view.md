# 01: The question browser takes one selected question view

**What to build:** Everything the `/play` block screen shows about the selected question for this team is worked out once, by a pure **selected question view** function next to the opened-questions and joker-round helpers. Given the player view, the **team view** (or none while unlinked), the team's pending answers and the selected question, it returns nothing with no selection, or: the question; the team's answer text and recorded clue (pending answer first); points, verdict and joker extra (null until graded or outside a doubled round); whether its round is doubled for the team; the team's purchases on this question only; and whether it is the question being answered now (block **Phone screen**, `answering` mode, answerable, linked). The play page builds it once and hands it to the question browser and the power-ups card. The selected-result builder and the selected-question half of the joker-marks builder go away (the header and joker title card half stays). The browser drops its question-specific props (selected question, team, answer, points, verdict, joker extra, joker flag, purchases, answerable) for the view, keeps its picker inputs, mode, reveal question, quickfire flag, navigation and callbacks, and no longer filters purchases itself. If the picker's answered marks still need the answers map, pass the picker that, not the team. The page binds the team id into the submit callback. The power-ups list builder takes the view's "answering now" question instead of working it out itself. Nothing a team sees changes. See the spec's "Implementation Decisions".

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Unit tests for the projection: no selection, unlinked, ungraded, graded with and without joker extra, doubled and undoubled round, a purchase on another question excluded, pending answer over a saved one, "answering now" in each phone screen mode; the selected-result builder's tests move here
- [x] Play-page case (add if missing): browsing back to a still-open earlier question shows the same power-up buttons in the card as the form's answerable state
- [x] The play tests for answers, joker round and chip, power-ups, pinned answers, Clue questions, break and reveal, the reveal verdict card, quickfire and question navigation pass unchanged
- [x] The browser's rendering, test ids and wording are unchanged; no change on `/control`, `/display` or `/remote`
- [x] No `GLOSSARY.md`, `DOCUMENTATION.md` or `/guide` change (no behaviour change)
- [x] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass

## Comments

**Implemented** (one commit, `refactor(frontend)`). `selectedQuestionViewOf` builds the view once on the play page; the question browser takes it in place of nine question-specific props, and the power-ups card takes its "answering now" question from it. The page binds the team id into the submit callback, which is null with no team.

Deviations from the spec, accepted on purpose:

- **No pending answer.** The phone never exposes its pending answer: the team's answers come only from the held team view, and the pending payload stays inside the team-link reducer. The spec's "pending answer first, as today" was wrong about today, so adding it would be a visible change, which is out of scope. There is no unit case for it.
- **"Unlinked" is covered by `isAnswerable`.** The team link already forces `isAnswerable` false while the phone isn't linked (no team included), so the "answering now" cases cover unlinked. The room split no longer checks for a team separately.
- **Inputs are the play page's existing pieces** (answers, joker extras, doubled rounds, purchases) plus the opened-questions list, not the raw team view. The opened-questions list keeps points and verdict hidden until the question is revealed, as before.
- **No fixture builder for the view.** The answer-draft test writes out the view's fields. The view is computed on the phone, not a server view, so it gets no `roomView`-style builder.
- `pinFor`, `removedOptionsOf` and the room split still filter by question id themselves. That's harmless on the narrowed purchases, and those are shared helpers used elsewhere.
