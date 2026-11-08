# 03: Clue value and answer freeze

**What to build:** A team's answer is worth less the more clues the room has seen, and it freezes once a new clue is shown.

- **Recording the clue.** Each answer to a Clue question records the clue it was locked in on: the highest clue shown when the answer was created or its value last changed. This is a new nullable column on `Answer`, null for other types (a migration).
- **Value.** The answer's value is 0.5 × (N − k + 1), using ticket 01's function.
- **Submit rules** (enforced on the server):
  - A resubmission with the same value is accepted and keeps its clue.
  - A resubmission with a different value is refused ("Your answer is locked in: a new clue has been shown") when its recorded clue is below the highest clue shown, and is accepted with the current highest clue otherwise.
  - That one rule keeps answers on the last clue changeable until the block locks.
  - A team that hasn't answered can still answer after the quiz master moves on, at the highest clue's value.
- **Grading.**
  - An exact match is graded correct at submit with the answer's value. Anything else waits for the quiz master.
  - A hand grade must be exactly 0 or the answer's value, and anything else is refused. The verdict is correct or incorrect, and `/control` offers no half button for this type.
  - A key fix re-scores each answer at its own value. A hand grade on a non-matching answer survives, as for Free text.
  - A joker doubles the result as usual.
- **Phone.**
  - Shows "Worth N points now".
  - While the answer could still freeze, shows next to Send: "Once the next clue is shown, you can't change this answer."
  - Shows a frozen answer read-only as "Locked in on clue N · worth X points".
  - At the reveal, adds "You answered on clue N" next to the verdict and points.
- **`/control`.** The answer list shows each answer's clue.

Update DOCUMENTATION.md (the Answer Lifecycle exception to last-write-wins, and grading). In CLAUDE.md's Known Tradeoffs, add the Clue question exception to "Last-write-wins answers", and add Clue questions next to Free text in "Live answer-key fixes". Any `/guide` text goes in ticket 05.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Submitting records the highest clue shown, and a migration adds the column
- [ ] A changed answer is refused once a newer clue is shown, an unchanged resubmission is accepted, and changes on the last clue are accepted (answer service spec against Postgres)
- [ ] An exact match is auto-graded at the answer's value (for example 2 on clue 2 of 5)
- [ ] A hand grade other than 0 or the answer's value is refused, and the half button is absent for this type
- [ ] A key fix re-scores each answer at its own value
- [ ] The phone shows "Worth N points now", the warning, the locked-in state and "You answered on clue N" (Vitest)
- [ ] `/control`'s answer list shows each answer's clue
- [ ] DOCUMENTATION.md and CLAUDE.md are updated
