# 01: Agreement walk pins today's Advance and Previous

**What to build:** A characterization spec that walks whole quizzes through the real-store gateway harness and, at every point, proves that the admin view's Advance/Previous availability and the /remote presenter preview's "next" line agree with what pressing ADVANCE or PREVIOUS actually does. It passes against today's code and is the safety net for moving the decision into the Move plan. Extend the existing Advance/Previous availability spec and its press-and-compare helpers rather than starting a new harness.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Walks cover: a two-block quiz through break, reveal and the end-of-block leaderboard; a kahoot round's between-questions leaderboard and its round-end leaderboard with the top-5 cutoff; a leaderboard tie; a closest_guess reveal with its sub-steps; an ended quiz with an active showdown (including "waiting for every guess")
- [x] At every point, the announced Advance availability matches whether pressing ADVANCE is accepted and moves the quiz (status, round, question, reveal position, closest_guess step, showdown step)
- [x] At every point, the announced Previous availability matches whether pressing PREVIOUS is accepted and moves the quiz
- [x] At every point, the presenter preview's "next" line is empty exactly when Advance moves nothing
- [x] While the leaderboard is up, the walk drives it the way today's clients do (reveal next team, then hide), so the spec pins current on-stage behaviour without relying on raw ADVANCE under the board
- [x] The spec passes against the current code with no production changes

## Comments

Implemented in `apps/backend/src/game/__tests__/action-availability.spec.ts` (new describe "the announced Advance slot and Previous state across whole quizzes"), no production changes. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state.

The announced Advance slot is computed the way `NavigationButtons` does today (reveal next team / hide leaderboard / advance / none), since the admin view has no such field yet. The forward walk presses that slot; the backward walk hides the board with the toggle first, then checks Previous.

Two real disagreements in today's code, pinned as named exceptions in `walkForward` so tickets 02/03 flip them:

1. **Final board, every rank shown, quiz ended (no showdown):** no Advance button (`canAdvance` false), but the preview's "next" line still says "Quiz complete!".
2. **Last showdown step:** `canAdvance` is true and the button shows, but ADVANCE moves nothing; the preview's "next" line is empty.

Because of (1), "preview empty exactly when Advance moves nothing" holds everywhere except under the final board.
