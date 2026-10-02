# 03: A closest-guess reveal reaches phones one step at a time

**What to build:** On the big screen, a closest-guess question's reveal builds up over five steps:

- (0) the question
- (1) + the lowest guess
- (2) + the highest guess
- (3) + the correct answer
- (4) + the closest team(s)

The players view sends that question with all of it from step 0. So a team's phone, and its history list since ticket 01, has the correct answer and the winners while the big screen is still on the question. After this, the players view carries, for the closest-guess question at `revealIndex`:

- the lowest guess from step 1
- the highest guess from step 2
- the correct answer (and answer media) from step 3
- the closest teams from step 4

The question at `revealIndex` counts as revealed on the phone (it shows "Correct:" and points) only from step 3. A closest-guess question with no submissions keeps its single-step reveal, with the answer straight away. Questions earlier in the walk, and the display and admin views, are unchanged. This uses the same technique `ActiveShowdownView` uses: fields are included progressively by step.

Out of scope in the spec (`.scratch/players-reveal-redaction/spec.md`, "Closest-guess step data"); this ticket picks it up.

**Blocked by:** 01 (it narrows the same players reveal trim)

**Status:** done

- [x] At the players projection, a closest-guess question at `revealIndex` with submissions carries:
  - step 0: no answer, no stats
  - step 1: the lowest guess only
  - step 2: the lowest and highest guesses
  - step 3: those plus the answer
  - step 4: everything
- [x] A closest-guess question with no submissions carries its answer at step 0.
- [x] Earlier closest-guess questions in the walk, and the display and admin views, carry the full data at every step.
- [x] Previous back through the steps removes the later fields again.
- [x] `/play`: at step 0–2, the history list shows no "Correct:" or points for that question; at step 3, it does; the phone's closest-guess reveal draws the same lines at each step as today.
- [x] `DOCUMENTATION.md`'s closest-guess reveal description notes that phones receive each step's data only once it is on air.

## Comments

The players projection's reveal trim now also trims the question at `revealIndex` by `closestGuessRevealStep` (`trimToClosestGuessStep` in `screen-projection.util.ts`): `closestGuess` gains `minGuess` from step 1, `maxGuess` from step 2, and `closestGuesses` from step 4; `answer`/`answerMediaUrl` arrive at step 3. A question with no submissions, earlier walk questions and the display/admin views are untouched. At steps 0–2 the question stays in `revealQuestions` without an `answer`, typed as the new `PendingClosestGuessRevealView` (`PlayersStatePayload.revealQuestions` is now a union), so the phone's existing "has an answer" check keeps the history list free of "Correct:" and points until step 3 with no phone logic change. `ClosestGuessRevealScreen`'s `correctAnswer` became optional for that case. New projection tests cover each step, no-submission, earlier questions, Previous and the other views; `/play` tests cover steps 2 and 3. The code landed in the commit `feat(backend): a closest-guess reveal reaches phones one step at a time`.
