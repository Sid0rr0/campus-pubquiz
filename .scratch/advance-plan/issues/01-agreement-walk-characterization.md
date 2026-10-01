# 01: Agreement walk pins today's Advance and Previous

**What to build:** A characterization spec that walks whole quizzes through the real-store gateway harness and, at every point, proves that the admin view's Advance/Previous availability and the /remote presenter preview's "next" line agree with what pressing ADVANCE or PREVIOUS actually does. It passes against today's code and is the safety net for moving the decision into the Move plan. Extend the existing Advance/Previous availability spec and its press-and-compare helpers rather than starting a new harness.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Walks cover: a two-block quiz through break, reveal and the end-of-block leaderboard; a kahoot round's between-questions leaderboard and its round-end leaderboard with the top-5 cutoff; a leaderboard tie; a closest_guess reveal with its sub-steps; an ended quiz with an active showdown (including "waiting for every guess")
- [ ] At every point, the announced Advance availability matches whether pressing ADVANCE is accepted and moves the quiz (status, round, question, reveal position, closest_guess step, showdown step)
- [ ] At every point, the announced Previous availability matches whether pressing PREVIOUS is accepted and moves the quiz
- [ ] At every point, the presenter preview's "next" line is empty exactly when Advance moves nothing
- [ ] While the leaderboard is up, the walk drives it the way today's clients do (reveal next team, then hide), so the spec pins current on-stage behaviour without relying on raw ADVANCE under the board
- [ ] The spec passes against the current code with no production changes
