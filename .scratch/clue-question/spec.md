# Spec: Clue question type, worth less with every clue shown

Status: ready-for-agent

## Problem Statement

Quiz masters want the classic "Who am I?" question. It starts with a vague clue and adds sharper ones until the room gets it, and a team that guesses early earns more than one that waits. The app can't do this today. The only option is to put every clue in the prompt of a Free text question. Then every team sees all the clues at once, nobody is rewarded for guessing early, and the quiz master can't hold clues back.

## Solution

A new question type, the **Clue question** (type id `clues`).

- **Clues.** The quiz author writes 2–8 **Clues** in order. While the question is on the big screen, each Advance shows the next clue to the whole room, on the big screen and on every phone.
- **Answering.** Teams type their answer, which is graded like Free text.
- **Points.** A right answer is worth half a point for every clue the room had not yet seen when the team answered, counting the latest clue shown. With 5 clues that is 2.5 · 2 · 1.5 · 1 · 0.5, so the clues set the question's points.
- **Freezing.** A team may change its answer while the same clue is up. Once a new clue is shown, its answer is frozen. The phone warns about this before the team sends.
- **Grading.** An answer is graded only right or wrong.
- **Reveal and break.** The reveal shows the answer and every clue. Two new fun facts in the break celebrate early guesses and stubborn questions.

## User Stories

1. As a quiz author, I want to choose "Clue question" as a question type in the editor, so that I can write a "Who am I?" question.
2. As a quiz author, I want to enter 2–8 clues in order, so that the room sees them from vaguest to sharpest.
3. As a quiz author, I want to reorder, add and delete clues, so that I can tune the difficulty curve.
4. As a quiz author, I want to see what a right answer is worth on each clue (e.g. "2.5 · 2 · 1.5 · 1 · 0.5"), so that I know what my clue count means for scoring.
5. As a quiz author, I want the points to follow from the number of clues, with no separate points field to set, so that the two can never disagree.
6. As a quiz author, I want a clear validation message when a question has fewer than 2 or more than 8 clues, or a clue contains `|`, so that I can fix it before saving.
7. As a quiz author, I want to type the answer the way I do for Free text, so that exact matches grade themselves.
8. As a quiz author, I want to import Clue questions from my sheet, with the clues in the `options` cell separated by `|`, so that I can write them alongside my other questions.
9. As a quiz author, I want an import to overwrite whatever is in the `points` cell with clues × 0.5 and show that in the import preview, so that I see the real points.
10. As a quiz author, I want a Clue question to export to CSV and import back unchanged, so that my sheet stays the source of truth.
11. As a quiz author, I want the Clue question to be unavailable in a quickfire quiz, so that I don't build a quiz that can't be played.
12. As a quiz author, I want a Clue question to carry media like any other question, so that a clue can come with a picture or sound.
13. As a quiz master, I want the big screen to show the first clue when the question opens, so that teams can start guessing straight away.
14. As a quiz master, I want each Advance to show the next clue on the big screen and phones, so that I control the pace.
15. As a quiz master, I want Advance on the last clue to move on to the next question, so that the question needs no extra presses.
16. As a quiz master, I want Previous to hide the latest clue on screen, so that I can undo a press that came too early.
17. As a quiz master, I want Previous on the first clue to go back to the question before, so that Previous works the way it does everywhere else.
18. As a quiz master, I want to come back onto a Clue question at the highest clue the room has seen, so that the screen never shows less than the room already knows.
19. As a quiz master, I want the presenter remote and `/control` to show which clue is on air and how many are left, so that I know where I am.
20. As a quiz master, I want a hand grade on a Clue question to offer only wrong (0) or right (the answer's value), so that I can't give a fraction of a point the app can't store.
21. As a quiz master, I want an answer that exactly matches the key to be graded correct automatically at its value, so that I only judge near-misses.
22. As a quiz master, I want a key fix on an opened Clue question to re-score each answer at its own value, so that a corrected key is fair to early and late guessers alike.
23. As a quiz master, I want a session restart to bring back the highest clue shown and each answer's clue, so that scoring survives a redeploy.
24. As a quiz master, I want `/control`'s answer list to show which clue each team answered on, so that I can see who guessed early.
25. As a quiz master, I want the `/guide` page to explain how to run a Clue question, so that a new moderator knows that Advance steps through the clues.
26. As a team, I want to see the clues shown so far on my phone, so that I don't need to read the big screen from the back of the room.
27. As a team, I want my phone to show "Worth N points now", so that I can decide whether to guess now or wait.
28. As a team, I want to be warned before sending that my answer can't be changed once the next clue is shown, so that the freeze doesn't catch me out.
29. As a team, I want to change my answer freely while the same clue is up, so that I can fix a typo.
30. As a team, I want my phone to show "Locked in on clue 2 · worth 2 points" once my answer is frozen, so that I know where I stand.
31. As a team, I want an answer sent on the last clue to stay changeable until the block locks, so that there's no freeze when no clue is left to show.
32. As a team that hasn't answered yet, I want to still answer after the quiz master has moved on (until the block locks), worth the value of the highest clue shown, so that a late answer is still possible.
33. As a team, I want to see no power-up offers on a Clue question, so that I don't try to buy something that doesn't apply.
34. As a team that played its joker on the round, I want my Clue question points doubled like any other, so that the joker works as usual.
35. As a team, I want the reveal to show the answer, every clue, my verdict, my points and the clue I answered on, so that I see how I did.
36. As a room, I want the reveal on the big screen to show the answer and every clue, including any we never saw, so that the whole story comes out.
37. As a room, I want a break fun fact like "The Quizzly Bears cracked *Who am I?* on the first clue", so that early guessers get their moment.
38. As a room, I want a break fun fact like "Nobody got *Who am I?* until clue 5", so that tough questions get remembered.
39. As a quiz master reading session stats, I want a Clue question's max points and correct rate to work like any other question's, so that stats stay comparable.

## Implementation Decisions

- **A new question type, `clues`, labelled "Clue question"**, added to the question type registry:
  - Typed answer (the `text` input kind, like Free text).
  - Grading mode `match-or-human`, the same as Free text.
  - `quickfireAllowed: false`.
  - `powerUps: []`.
  - `revealKind: 'answer'`.
  - `hasCorrectRate: true`.
  - `briefWrongAnswers: 'typed'`.
  - No grading settings or scoring modes.
  - It gets a moderator note and a player note.
- **Clues ride in the question's options.** The payload, preview, views and CSV carry the ordered clue list in the same field that choice and sort types use for their options. CSV uses `|` between clues, with a sort-like codec: options cell = clues, answer cell = answer. The preview schema requires 2–8 clues, refuses `|` in a clue, and requires a non-empty answer.
- **Points are derived.** The preview schema sets points to clue count × 0.5 for both import and draft save, whatever was entered. Every downstream reader (max points, correct rate, standings) then works unchanged. The editor hides the points field for this type and shows the per-clue value list in its place.
- **The clue value.** The value of an answer locked in on clue `k` of `N` is `0.5 × (N − k + 1)`. One shared function computes it, and scoring, the phone's "Worth N points now", the editor's value list and the hand-grade check all use it.
- **Two new pieces of state:**
  - **Clue the answer was locked in on.** A new nullable integer column on `Answer`. It is written when an answer is created or its value changes, and set to the highest clue the room had seen at that moment. It is null for other types. Needs a migration.
  - **Highest clue shown per question.** A new map on the session state, from question id to the highest clue shown. It only grows and is saved with the game progress next to the opened question ids (a new column on the game session, plus a migration). Like opened questions, Previous never lowers it.
- **Stepping through clues reuses the Stepped reveal module** as a third kind, `clues`, beside `closest_guess` and `showdown`:
  - Its descriptor has one step per clue, falls through at both ends, and its first Advance never waits.
  - It is on air while a `clues` question is the question being asked.
  - Its start step is a special case: landing forward or backward puts it on the highest clue shown for that question (the first clue on first opening). The existing start rule ("first step forward, last step on Previous") doesn't apply.
  - Each step forward raises the highest-clue-shown map when the step is new. Previous only lowers the on-screen step.
  - The on-screen step stays ephemeral (the existing `revealStep`). After a restart it is rebuilt from the highest clue shown.
  - Update the glossary's **Stepped reveal** entry to name the clue walk as a third user.
- **Screen projection.**
  - While the question is asked, the display and players views carry only the clues up to the step on air, plus the value for the highest clue shown. Clues beyond it never leave the server.
  - At the reveal, both views carry all the clues.
  - The players view also carries, for the team's own answer, the clue it was locked in on and whether it is frozen.
  - The admin view's answer list carries each answer's clue number.
- **Submit rules** (the answer service, at the trust boundary):
  - A new answer records the highest clue shown.
  - A resubmission with the same value is accepted and keeps its old clue number.
  - A resubmission with a different value is refused ("Your answer is locked in: a new clue has been shown") when the stored answer's clue number is below the highest clue shown, and is otherwise accepted with the current highest clue.
  - This rule alone covers "changeable on the last clue", because the highest clue shown can never pass N.
  - This is the one exception to last-write-wins.
- **Grading.**
  - At submit, an exact match (as for Free text) is graded correct with the answer's clue value. Any other answer is left ungraded.
  - A hand grade on a `clues` answer must be exactly 0 or the answer's clue value. Anything else is refused, and the Grading policy offers no half button for this type.
  - The verdict is `correct` or `incorrect`.
  - A key fix re-scores through the existing auto-graded re-grade path, using each answer's own clue value. A hand grade on a non-matching answer survives, as for Free text.
  - Joker doubling is derived as today (ADR 0004), so nothing needs adding.
- **Fun facts.** Two new kinds:
  - `clue_cracked_early`: the teams with the earliest correct answer, when that clue is before the last.
  - `clue_last_gasp`: the question, when its earliest correct answer came after clue 1.
  - Both come only from revealed blocks, like every fun fact. The fun fact data needs each answer's clue number.
- **Phone.**
  - It shows the clue list so far and "Worth N points now".
  - On an answer that could still freeze, a warning sits next to Send: "Once the next clue is shown, you can't change this answer."
  - A frozen answer shows read-only as "Locked in on clue N · worth X points".
  - The reveal adds "You answered on clue N".
- **Big screen.** It shows the clues so far as a list that grows with each step. The reveal shows the answer and all the clues.
- **`/control` and the presenter remote.** They show "Clue N of M" for the clue on air.
- **Docs, in the same commit as the code:**
  - DOCUMENTATION.md: question types, the answer lifecycle exception, CSV.
  - The `/guide` page: running a Clue question.
  - CLAUDE.md: the "Last-write-wins answers" tradeoff gets the Clue question exception, and the "Live answer-key fixes" tradeoff gets Clue questions next to Free text.
  - GLOSSARY.md: **Clue question** and **Clue** are already added. **Stepped reveal** needs updating.

## Testing Decisions

- **What makes a good test.** It drives a public interface (registry validation, scoring, the stepped walk through presses, screen projection, the answer service, rendered components) and asserts on what a caller or user sees: grades, refusals, the clues on a view, rendered text. It doesn't assert on internal helpers or call shapes.
- **Seam 1 (primary): pure modules in `shared/types`.**
  - **Registry:** the `clues` entry is excluded from quickfire and takes no power-ups. The schema refuses 1 and 9 clues and a `|` in a clue, and derives points. The CSV round trip comes back unchanged. Prior art: the question-kind parity, question import boundary and question CSV round-trip tests.
  - **Clue value and scoring:** 5, 4 and 3 clues at every step, and a correct answer earning its value at submit. Prior art: the scoring test.
  - **Stepped walk:**
    - Advance goes clue by clue and then falls through to the next question.
    - Previous hides a clue, and on the first clue goes back to the question before.
    - Coming back lands on the highest clue shown.
    - The highest clue shown never drops.
    - Prior art: the stepped-reveal, move-plan and session-settle tests.
  - **Screen projection:** no clue beyond the step on air leaves in any view, the reveal carries all clues, and the players view carries the team's lock-in. Prior art: the screen-projection and session-display-screen tests.
  - **Fun facts:** the early and last-gasp facts, and nothing from an unrevealed block. Prior art: the fun-facts test.
- **Seam 2: the backend answer service against Postgres.**
  - Submit records the clue.
  - A changed answer is refused after a new clue and accepted on the last clue. An unchanged resubmission is accepted.
  - An exact match is auto-graded at its value.
  - A hand grade other than 0 or the value is refused.
  - A key fix re-scores each answer at its own value.
  - The highest clue shown survives a restart.
  - Prior art: the auto-grading, grading and submit-and-list specs, and the saved-progress restore tests.
- **Seam 3: frontend components (Vitest).**
  - The editor's clue list and value line.
  - The phone's warning, its "Locked in" state and its "Worth N points now".
  - The big screen's growing clue list and full reveal.
  - Prior art: the quiz editor panel tests, the play free-text answer tests and the display reveal tests.
- An e2e journey is optional and not required by this spec.

## Out of Scope

- Clue questions in quickfire quizzes.
- Power-ups on Clue questions, including a "skip a clue" or "peek at the next clue" power-up.
- Clues shown per team, at each team's own pace.
- Clues added to other question types (multiple choice with clues, number with clues).
- Points that don't follow the clue count (custom per-clue values, a different step).
- Half grades on Clue questions.
- A big-screen "most teams answered on clue N" line on the reveal.
- Undoing a clue shown by mistake: Previous hides it on screen, but the room has seen it and scoring keeps it.

## Further Notes

- Domain terms used: **Clue question**, **Clue**, **Stepped reveal**, **Grading**, **Verdict**, **Answer key**, **Fun fact**, **Joker round**, **Block**, **Locked**, **Opened question**, as defined in GLOSSARY.md.
- Freezing answers is the one break from "teams can revise until the block locks". It was a deliberate choice: without it, a team could answer on clue 1 and quietly fix its answer after clue 4 at the clue 1 value.
- No ADR: the freeze rule and the derived points are cheap to reverse, and the CLAUDE.md tradeoff notes record them.
