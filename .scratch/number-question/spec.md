# Spec: Number question type, graded against a margin

Status: done

## Problem Statement

Plenty of pub quiz questions have a number for an answer: "In what year did the Berlin Wall fall?", "How tall is the Eiffel Tower in metres?", "How many bones are in the human body?". Today a quiz author has two choices, and both are poor:

- **Free text** accepts only an exact, case-insensitive match. "330" is correct and "324" is not, and "1,989" or "1989.0" falls through to the quiz master. During the break the quiz master has to hand-grade every near miss, and the result depends on their mood rather than a rule the teams knew in advance.
- **Closest guess** gives points only to the team(s) nearest the key. That's a different game. The author can't say "everyone within 10% scores".

There's no way to say "a number, correct if it's close enough", and teams have no way to know how precise they need to be.

## Solution

Add a new question type, **Number** (ADR 0003). Its answer is a number, and it is graded automatically when a team submits, against a **margin**: how far an answer may be from the key and still be correct. The margin is either a percentage of the key or an absolute amount. Both ends count as correct, and 0 means the exact key only.

- The quiz author sets the margin in the quiz editor only. It defaults to 10%. A Number question imported from CSV always gets 10%.
- Teams answer on a number keypad and see the margin under the question while answering ("within 10%").
- An answer inside the margin is graded correct with full points, and anything else is graded incorrect, at submit time. Nothing waits for the quiz master, who can still override any grade by hand.
- On reveal, the big screen and phones show the key plus the accepted range ("200 · 180–220 accepted").
- Number questions are allowed in kahoot rounds and earn the kahoot speed score (ADR 0001, amended).
- Changing the key, points or margin of an opened Number question during a live session re-scores its answers, like any other auto-graded type.

## User Stories

1. As a quiz author, I want to choose "Number" in the question type picker, so that I can write a question whose answer is a number that doesn't have to be exact.
2. As a quiz author, I want a new Number question to start with a margin of 10%, so that the common case needs no extra clicks.
3. As a quiz author, I want to switch a question's margin between a percentage and an absolute amount, so that I can say "within 10%" for a population or "within 5 years" for a date.
4. As a quiz author, I want to type the margin's value, including decimals, so that I can allow "within 0.5 metres" or "within 2.5%".
5. As a quiz author, I want a margin of 0 to mean only the exact key is correct, so that I can have exact number questions with a number keypad.
6. As a quiz author, I want the editor to refuse a negative margin, so that I can't save a question nobody can answer correctly.
7. As a quiz author, I want the editor to refuse a percentage over 100, so that I don't save a margin that accepts nonsense by mistake.
8. As a quiz author, I want the editor to refuse an answer that isn't a number, so that a Number question can always be graded.
9. As a quiz author, I want a hint when the key is 0 and the margin is a percentage, so that I know only an exact 0 will be accepted and can switch to an absolute margin.
10. As a quiz author, I want switching a question from Free text to Number to keep its prompt, and its answer if that's a number, so that turning an existing question into a Number question costs nothing.
11. As a quiz author, I want the margin controls to show only for Number questions, so that the editor stays uncluttered for every other type.
12. As a quiz author, I want to import Number questions from a CSV by writing `number` in the type cell and the key in the answer cell, so that I can author a quiz in a spreadsheet as usual.
13. As a quiz author, I want an imported Number question to get the 10% default margin, so that it's ready to play without opening the editor.
14. As a quiz author, I want a CSV import to reject a Number question whose answer isn't a number, with the same message as closest guess, so that bad rows are caught before quiz night.
15. As a quiz author, I want exporting a quiz to CSV to write Number questions as type `number` with their key, so that the export round-trips except for a custom margin.
16. As a quiz author, I want to put Number questions in a kahoot round, so that I can run fast numeric rounds.
17. As a quiz author, I want the `/guide` page to explain how Number questions are authored and graded, so that I know what teams will experience.
18. As a team, I want a number keypad when answering a Number question, so that typing the answer is quick on my phone.
19. As a team, I want to see the margin under the question ("within 10%", "within 5"), so that I know how precise my answer needs to be.
20. As a team, I want to revise my Number answer until the block locks, so that I can change my mind like on any other question.
21. As a team, I want my answer graded the moment I submit it, so that the score doesn't depend on the quiz master's judgement.
22. As a team, I want an answer exactly on the edge of the margin to count as correct, so that "within 10%" means what it says.
23. As a team, I want to answer "I don't know" on a Number question, so that it works like every other question.
24. As a team, I want to see the key and the accepted range on reveal, so that I understand why my near miss did or didn't count.
25. As a team in a kahoot round, I want a correct Number answer to earn more the faster I submit, so that Number questions play like the other kahoot questions.
26. As a quiz master, I want Number answers never to be ungraded, so that they never hold up leaving the break.
27. As a quiz master, I want to override any Number grade by hand, so that I can be generous with a team that, for example, gave the answer in the wrong unit.
28. As a quiz master, I want fixing a wrong key or margin on a live Number question to re-score every answer to it, so that one typo doesn't wreck the scores.
29. As a quiz master, I understand that fixing the key or margin live wipes my manual grades on that question, so that I know to re-grade in the break (accepted tradeoff, same as other auto-graded types).
30. As an audience member, I want the big screen to show the margin while the question is up and the accepted range on reveal, so that I can follow along.
31. As a quiz author, I want existing Free text questions left as they are, so that my old quizzes play exactly as before.

## Implementation Decisions

- **A new question type, `number`, labelled "Number"** (ADR 0003), added to the question type registry:
  - Answer kind: a number, like closest guess.
  - Choices: none.
  - Media is optional.
  - Grading mode: auto.
  - Kahoot: allowed.
  - Uses the answer-only CSV codec.
  - Has a `/guide` moderator note.
- **The margin is a per-question field, following `matchScoringMode` all the way through.** It lives in the question payload, the import/draft preview shape, the question views and the keyed-question slice that scoring reads. It has no CSV column and is set only in the editor. Shape: a value (non-negative number) and a unit (`percent` | `absolute`). When omitted, it defaults to `{ value: 10, unit: 'percent' }`.
- **Validation in the Number preview schema** (the one schema used by both import and draft save):
  - The answer must be a finite number, with the same rule and message as closest guess.
  - The margin value must be ≥ 0.
  - A percentage must be ≤ 100.
  - A missing margin is filled with the 10% default.
  - The payload schema for `number` accepts the margin.
- **Grading.** A key of 0 with a percentage margin follows from the formula, so only an exact 0 is correct.
  - The number answer format gets a real per-answer score: the answer is correct with full points when |answer − key| ≤ allowed, otherwise incorrect with 0 points.
  - `allowed` is the margin value for an absolute margin, or `|key| × value / 100` for a percentage.
  - An answer that doesn't parse as a finite number is incorrect.
  - "I don't know" is handled as it is for every type.
  - There is no partial verdict.
- **Simplification.** Once the number format has a score, no answer kind lacks a per-answer score.
  - The "no per-answer score" placeholder in Scoring and the nullable `score` on the answer format go away.
  - Closest guess is unaffected, because grading at submit never grades a batch type and the batch grader decides its result.
- **Kahoot speed.** Scoring applies the existing speed multiplier, so nothing Number-specific is needed.
- **Live edits.** The margin is added to the grading-input fields that the live-edit guard watches (next to `answer`, `points` and `matchScoringMode`). Changing it on an opened question re-scores that question's answers through the existing auto-graded re-grade path, discarding manual overrides.
  - The type is already an opened-question field, so an opened Free text question can't be switched to Number live.
- **Presentation.** One shared formatter in the types package turns a key and margin into the strings all surfaces use:
  - While answering: the margin as "within 10%" or "within 5".
  - On reveal: the accepted range as "180–220".
  - Numbers show at most 2 decimal places, with trailing zeros dropped.
  - Grading always uses the exact range, never the rounded text.
- **Phone.** The phone reuses the existing number answer input (decimal keypad), so a phone set to a comma-decimal locale handles `,` without extra work. The margin text appears under the prompt while the question is open.
- **Big screen.** It shows the margin text while the question is up, and the key followed by "· <range> accepted" on reveal.
- **Editor.** When the type is Number, the editor shows a margin row: a number field plus a % / absolute toggle, defaulting to 10%. It sits next to the answer field, the way match shows its scoring-mode select. Switching type from Free text to Number keeps the prompt, and keeps the answer if it parses as a number. The key-0-with-% hint is advisory, not a validation error.
- **Persistence.** The quiz service writes the margin into the stored payload and reads it back into the draft, the same way it handles `matchScoringMode`. Payloads are JSON, so no DB migration is expected.
- **Docs, in the same commit as the code:**
  - DOCUMENTATION.md: question types, grading, CSV (Number type, and the margin not exported).
  - The `/guide` page: moderator note and editor controls.
  - CLAUDE.md: add Number to the "live answer-key fixes overwrite manual overrides" tradeoff.
  - GLOSSARY.md (Margin, question type list) and ADRs 0001/0003 are already updated.

## Testing Decisions

- **What makes a good test:** it drives a public interface (scoring functions, the registry's validation, the CSV codec, the answer service, rendered components) and asserts on what a user or caller sees: grades, validation issues, round-tripped questions, rendered text. It does not assert on internal helpers or call shapes.
- **Seam 1 (primary): Scoring and the question registry, in the shared types package.** Pure functions, no DB or UI. Covers:
  - Grading at submit: inside, both edges, just outside, % vs absolute, key 0 with %, negative keys and answers, decimals, non-numeric input, "I don't know".
  - The kahoot speed multiplier on a correct Number answer.
  - Number is kahoot-allowed.
  - Preview-schema validation: non-numeric answer, negative margin, % > 100, missing margin defaults to 10%.
  - The CSV round trip: Number comes back as Number with 10%.
  - The margin and range formatter (rounding, trailing zeros).
  - Prior art: the existing scoring tests, question-kind parity and presentation tests, the CSV round-trip test, the answer-kind test.
- **Seam 2: backend answer service integration (Postgres).**
  - Submitting a Number answer stores a correct or incorrect grade at once and never leaves it ungraded.
  - Editing the margin or key on an opened Number question re-scores existing answers and discards a manual override.
  - Prior art: the auto-grading spec and the regrade-auto-graded block of the grading spec. The live-edit guard spec covers the margin being treated as a grading input.
- **Seam 3: quiz editor panel.**
  - The margin row shows only for Number, defaults to 10%, and the toggle switches units.
  - Validation messages appear.
  - Switching from Free text keeps the prompt and a numeric answer.
  - Prior art: the quiz editor panel and quiz draft state tests.
- **Seam 4: display and phone components.**
  - The margin text shows while answering.
  - The key plus the accepted range shows on reveal.
  - The number keypad input is used.
  - Prior art: the display reveal test and the play free-text / multiple-choice answers test.

## Out of Scope

- Partial credit for answers close to but outside the margin. There is no tiered scoring.
- A margin column in the CSV. A custom margin is lost on export and re-import, by decision.
- Migrating existing Free text questions whose answer happens to be a number.
- Units, unit conversion, or parsing answers like "1.2k" or "330m". The phone sends a plain number.
- Asymmetric margins ("up to 10 below, 5 above").
- Changes to closest guess.
- Attributing grades to the quiz master who gave them. That's an existing accepted gap.

## Further Notes

- Domain terms: **Margin**, **Question type**, **Answer kind**, **Grading**, **Ungraded**, **Kahoot round** as defined in GLOSSARY.md. ADR 0003 records why Number is its own type and not a free text mode. ADR 0001 records why Number, unlike free text, is allowed in kahoot rounds.
- The margin text the phones show must come from the same formatter the big screen uses, so the two never disagree.
