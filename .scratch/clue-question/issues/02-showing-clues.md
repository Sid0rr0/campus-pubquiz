# 02: Showing clues one at a time

**What to build:** While a Clue question is on the big screen, the quiz master steps through its clues.

- **Opening.** The question opens on clue 1.
- **Advance** shows the next clue on the big screen and on every phone. On the last clue, Advance moves to the next question.
- **Previous** hides the latest clue on screen. On clue 1, Previous goes back to the question before.
- **Coming back.** Returning onto the question, whether forward or by Previous from the question after, lands on the **highest clue shown** for that question.

Stepping through clues is a third kind, `clues`, in the Stepped reveal module, beside `closest_guess` and `showdown`. Its descriptor has one step per clue, falls through at both ends and never waits on its first Advance. Its start step is the highest clue shown, not the module's usual "first forward, last on Previous" rule.

The highest clue shown per question is new session state. It only grows (Previous never lowers it) and is saved with the game progress next to the opened question ids (a migration on the game session). After a restart the clue walk resumes on it.

Views:
- The display and players views carry only the clues up to the step on air.
- At the reveal, both views carry the answer and every clue, including ones never shown.
- The big screen shows the clues so far as a list that grows with each step.
- The phone shows the same list under the prompt.
- `/control` and the presenter remote show "Clue N of M".

Update DOCUMENTATION.md (the Clue question entry and the Advance/Previous behaviour). Any `/guide` text goes in ticket 05.

**Blocked by:** 01

**Status:** done

- [ ] Stepped reveal tests: Advance steps clue by clue and then falls through, Previous steps back and falls through at clue 1, and the first Advance never waits
- [ ] Returning onto the question, forward or backward, lands on the highest clue shown, and the highest clue shown never drops on Previous
- [ ] The highest clue shown is saved with the progress and restored after a restart (a migration is included)
- [ ] Screen projection: no view carries a clue beyond the step on air, and the reveal carries every clue
- [ ] The big screen and phone show the growing clue list, and `/control` and the remote show "Clue N of M"
- [ ] Other stepped reveals (closest guess, showdown) behave as before
- [ ] DOCUMENTATION.md is updated
