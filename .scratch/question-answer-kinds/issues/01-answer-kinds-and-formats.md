# 01: Answer kinds and answer formats, with scoring going through them

**What to build:** Every question has one answer kind (text, number, choice, sort or match), worked out in one place, and each answer kind has one answer format in the shared types. Scoring scores through the formats, so a question type with no scoring rule is caught in CI instead of silently marking every answer wrong on quiz night. No score changes for any existing question or answer.

First, pin today's behaviour in tests against the current Scoring module and answer formatter:

- base scores and verdicts for every question type, including both match scoring modes, half points, and sort's tolerance for stray whitespace and empty items;
- the formatted answer text, including "I don't know".

Then add:

- **The answer kind resolver.** A `required`-choices type is always `choice`. An `optional`-choices type is `choice` once the question carries at least one choice with text, and otherwise its registry input kind. Every other type takes its registry input kind.
- **The answer formats**, in a map keyed by every answer kind. Each one decodes a stored answer into parts, encodes parts back, formats the answer as readable text, and compares it with the key to give the base score and verdict. The number kind has no per-answer score; closest_guess stays batch-graded.

The Scoring module's base score then comes from the format for the question's answer kind, replacing the switch on question type and its "anything else is incorrect" fallthrough. Check that nothing still scores closest_guess one answer at a time.

Docs in the same commit: `GLOSSARY.md` gains **Answer kind** next to Question type (_Avoid_: input kind). `CODING_STANDARDS.md`'s "Question types are defined once" rule gains: behaviour that differs by how a question is answered goes in the answer format or a surface's answer-kind map, never in a branch on sort, match or choices. `DOCUMENTATION.md`'s question-type section names the answer kinds and how optional choices decide one.

Parent spec: `.scratch/question-answer-kinds/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Written first, passing against today's code: table tests pinning base scores and verdicts for every question type, and the formatted answer text.
- [ ] The answer kind resolver is tested over every question type, with and without choices, including an optional-choices question whose choices are all blank (not `choice`).
- [ ] Each answer format's decode and encode round-trip, including stray whitespace and empty items.
- [ ] A test walks every question type: a correct answer built through its format's encode scores "correct" through the Scoring module (closest_guess through its batch). Removing a format's score makes it fail.
- [ ] The Scoring module no longer switches on question type for the base score; the pinned score tests pass unchanged.
- [ ] The backend grading, submit-answer, kahoot speed and live-edit regrade specs pass unchanged.
- [ ] GLOSSARY, CODING_STANDARDS and DOCUMENTATION are updated in the same commit.
