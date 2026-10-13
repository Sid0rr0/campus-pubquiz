# 01: Number question type with a fixed 10% margin

**What to build:** A quiz author can create a **Number** question (ADR 0003). They can pick it in the quiz editor's type picker, or import it from CSV with `number` in the type cell. The answer must be a number. A team answers on the phone's number keypad, and the answer is graded the moment it's submitted against a fixed **margin** of 10% of the key. Inside the margin, edges included, it's correct with full points. Anything else is incorrect. A Number answer is never ungraded, and the quiz master can still override any grade by hand. Number questions are allowed in kahoot rounds and earn the kahoot speed score (ADR 0001). Reveal shows the key the same way other types do. Showing the margin and the accepted range comes in 03, and making the margin editable comes in 02.

The margin is stored with the question in the same place as match's scoring mode, so 02 only has to expose it. A question without a stored margin gets the default `{ value: 10, unit: 'percent' }`.

Once the number answer kind has a real per-answer score, no answer kind is left without one. Delete the "no per-answer score" placeholder in Scoring and make the answer format's score non-nullable. Closest guess is unaffected, because grading at submit never grades a batch type.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The registry has a `number` type labelled "Number", with these settings: number answer kind, no choices, optional media, auto grading, kahoot allowed, the answer-only CSV codec, and a `/guide` moderator note.
- [ ] The Number preview schema rejects an answer that isn't a finite number, with the same message as closest guess. It fills in the 10% default when the margin is missing.
- [ ] Grading at submit (allowed = |key| × 10 / 100):
  - correct with full points when |answer − key| ≤ allowed, otherwise incorrect with 0 points;
  - an answer that isn't a finite number is incorrect;
  - "I don't know" behaves as for every other type;
  - a key of 0 accepts only an exact 0;
  - negative and decimal keys and answers work.
- [ ] A correct Number answer in a kahoot round is scaled by the speed multiplier.
- [ ] The answer service stores a correct or incorrect grade at submit for a Number answer and never leaves it ungraded (Postgres integration spec, next to the existing auto-grading spec).
- [ ] Changing the key or points of an opened Number question during a live session re-scores its answers through the existing auto-graded re-grade path.
- [ ] CSV import → export → import round-trips a Number question.
- [ ] The phone shows the number keypad input for a Number question.
- [ ] The "no per-answer score" placeholder is gone, the answer format's score is non-nullable, and the closest guess tests still pass.
- [ ] The question types, grading and CSV sections of DOCUMENTATION.md describe Number. The `/guide` page shows its moderator note.
- [ ] CLAUDE.md's "live answer-key fixes overwrite manual overrides" tradeoff mentions Number among the auto-graded types.
