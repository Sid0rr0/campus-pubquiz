# Spec: One answer kind per question, defined once for every surface

Status: ready-for-agent

Blocked by: — (follows question-kind-module and scoring-module, both done)

## Problem Statement

The question type registry promises that a question type is defined once: "a type without an entry is a compile error rather than a crash live on stage". That holds for the data side (validation, payload, CSV, grading mode, kahoot eligibility). It doesn't hold for how a question is **answered**: how an answer is entered, stored, scored, shown on the big screen and edited. Every surface works that out for itself:

- **Scoring compiles with a gap.** The Scoring module scores by switching on the question type and ends in "anything else is incorrect". A new auto-graded type compiles fine and marks every team's answer wrong, live on stage. That's exactly the failure the registry exists to prevent.
- **"Is this answered by picking a choice?" has three answers.** The phone's answer form, the quiz editor's draft and the editor's load step each decide differently whether an audio or YouTube question answers from choices: "the type allows choices and the question has some", "at least one choice has text", and "the question has any choices". A question can be shown with choices on one surface and as a text box on another.
- **Encoding and decoding live apart.** A sort or match answer is read back with the shared pipe-list helper, but written by each answer component, and by the editor, joining items itself.
- **Every surface repeats the same branches.** The phone's answer form, the big screen's question display (three times: asking, revealing, and a team's own answer at reveal), the answer formatter and the editor all start with "is it sort? is it match? does it have choices?", then check that the optional fields that kind needs are actually there.
- **Adding a question type touches about twelve places**, and nothing but review tells you which ones you missed.

For quiz masters, teams and the person adding the next question type, this means a slip in any one of those places surfaces on quiz night, not at compile time.

## Solution

Every question has one **answer kind** (typed text, a number, picking a choice, putting items in order, or pairing items up), worked out in one place from its question type and whether it carries choices. Each answer kind has one **answer format** in the shared types. The format decodes a stored answer into its parts and encodes parts back, turns it into text people read, and scores it against the key. Each surface (the phone's answer input, the big screen's question and reveal, the quiz editor's answer section) holds a map with an entry for every answer kind. A missing entry, on any surface or in the formats, is a compile error.

For the people in the room nothing changes: every question looks, answers and scores exactly as it does today. The difference is that the three surfaces can no longer disagree about how a question is answered, and the next question type can't ship half-wired.

## User Stories

1. As a team, I want an audio or YouTube question with choices to show those choices on my phone exactly when the big screen shows them, so that we answer the question the room sees.
2. As a team, I want a sort or match answer I submit to be stored and read back the same way on every screen, so that my phone, the big screen and the quiz master's list show the same answer.
3. As a team, I want my answer to a correct sort or match to score as correct, whatever screen it was entered on, so that we get our points.
4. As a team, I want my restored answer after a reconnect to reappear in the same form I entered it, so that I can see and change what we sent.
5. As a team, I want "I don't know" to look and score the same on every kind of question, so that it's always a clear zero.
6. As a quiz master, I want the answers list on `/control` to show each team's answer in the same readable form the big screen uses, so that I grade what the room sees.
7. As a quiz master, I want a match answer shown as "left → right" pairs everywhere it's listed, so that I can check it at a glance.
8. As a quiz master authoring a quiz, I want the editor to offer choices for an audio or YouTube question by the same rule the phone uses to show them, so that what I author is what teams get.
9. As a quiz master, I want saving and reopening a quiz to keep every answer in the same form, so that an edit never reshuffles a sort order or match pairing.
10. As a quiz master, I want every question type's scoring to stay exactly as it is today, so that nothing changes mid-season.
11. As the audience, I want the big screen to show sort items, match pairs and choices the same way when asking and when revealing, so that the reveal reads as the answer to the question we saw.
12. As the audience, I want a team's own answer at reveal shown in the same layout as the correct answer, so that the comparison is obvious.
13. As a developer adding a question type, I want the compiler to list every surface and format I still have to fill in, so that I can't ship a type that silently scores zero.
14. As a developer adding a question type that reuses an existing answer kind, I want to add only its registry entry, so that a new typed-answer type needs no new surface code.
15. As a developer, I want one place that decides whether a question is answered by picking a choice, so that the phone, the big screen and the editor can't disagree.
16. As a developer, I want each answer kind's encode and decode to live side by side and be tested as a round trip, so that a change to one can't break the other.
17. As a developer, I want each surface to render a question by looking up its answer kind rather than branching on sort, match and choices, so that each surface reads as one list of kinds.
18. As a developer, I want a test that walks every question type through encode and score, so that a type missing a scoring rule fails in CI.
19. As a developer, I want the lint rule against comparing question types to literals to keep holding, with answer kinds as the sanctioned way to branch, so that new branches go through the registry.
20. As a developer reading the glossary, I want "answer kind" defined next to "question type", so that I know which one to branch on.

## Implementation Decisions

- **Answer kind is a new domain term.** It's how a question is answered: `text`, `number`, `choice`, `sort` or `match`. It is resolved from the question, not just its type. A question type whose choices are `required` is always `choice`. A type whose choices are `optional` is `choice` when the question carries at least one choice with text, and otherwise its registry input kind. Every other type takes its registry input kind. One resolver in the shared types does this, and every surface calls it. It replaces all three current definitions of "answers from choices". The registry entry's existing input kind field stays as the default the resolver falls back on.
- **Answer format: one per answer kind, in the shared types**, held in a map keyed by every answer kind, so a missing kind is a compile error. Each format:
  - decodes a stored answer into that kind's parts, and encodes parts back into the stored string, so a sort or match answer is no longer joined by hand anywhere;
  - formats a stored answer as text people read: the "left → right" pairs for match given the question's left items, the arrow chain for sort, and the value as-is for the rest. "I don't know" is handled once, in front of every format;
  - compares a stored answer with the key and gives the base score and verdict. Text and choice keep today's comparisons. Sort keeps its tolerance for stray whitespace and empty items. Match keeps both match scoring modes and half points. The number kind has no per-answer score: closest_guess stays graded in one batch by the Scoring module.
- **The Scoring module scores through the answer format.** Its base score comes from the format of the question's answer kind, not from a switch on the question type, so the "anything else is incorrect" fallthrough is gone. Grading mode stays a property of the question type: when an answer is graded at submit, batch grading, speed scaling, and manual grades are unchanged. **No score changes for any existing question or answer.** That is a hard constraint, pinned by tests before any code moves.
- **Each surface has a map with an entry for every answer kind:**
  - **phone answer input:** how the team enters and changes an answer, including the kahoot one-tap behaviour for choices and restoring a submitted answer;
  - **big screen question body:** what the big screen shows while asking (choices, sort items, both match columns, or nothing extra);
  - **big screen reveal body:** what it shows at reveal, both the correct answer and, when given, a team's own answer laid out the same way;
  - **editor answer section:** the quiz editor's answer fields for that kind, plus converting between the stored question and the editor's draft for that kind.

  Each page renders the entry for the question's answer kind. Branching on sort, match or choices outside these maps goes away.

- **The wire question view doesn't change.** Surfaces still receive the same question and reveal views, with optional choices, match targets and closest_guess data. Each answer kind's entry reads the fields its kind needs and treats a missing one as nothing to show, as today. Reshaping the view into a union by answer kind belongs with the socket protocol work (review candidate 4).
- **The lint rule stays as is.** It already bans comparing a question's type to a literal. Branching by answer kind goes through the maps, so no new rule is needed.
- **Docs, in the same change:**
  - `GLOSSARY.md` gains **Answer kind** under Quiz structure, next to Question type: what a question asks teams to do versus how they enter it. _Avoid_: input kind (the registry field that is its default).
  - `CODING_STANDARDS.md`'s "Question types are defined once" rule gains: behaviour that differs by how a question is answered goes in the answer format or the surface's answer-kind map, never in a branch on sort, match or choices.
  - `DOCUMENTATION.md`'s question-type section names the answer kinds and how optional choices decide one.
  - The `/guide` page is unchanged.

## Testing Decisions

- **A good test goes through a module's interface and asserts what a person or the next module sees:** the stored string, the formatted text, the score and verdict, what the phone and big screen render, and what the editor saves. Don't assert which map entry was picked or how a surface is split up inside.
- **Seam 1 (new): the answer format interface in the shared types.** Table-driven tests per answer kind:
  - decode and encode round-trip, including stray whitespace and empty items;
  - the formatted text, including "I don't know" and a match without left items;
  - base scores matching today's results, written first against the current Scoring module so they pin behaviour before it moves.

  The answer kind resolver gets a table over every question type, with and without choices, including an optional-choices type whose choices are all blank. One test walks **every question type**: build a correct answer through its format's encode, score it through the Scoring module, and expect "correct", except closest_guess, which is checked through its batch. This test fails if a new type has no scoring rule.

- **Seam 2 (existing): the frontend's component and page tests.** The phone's free-text-and-multiple-choice and sort-and-match answer tests, the big screen's question display and reveal tests, the quiz editor panel and draft state tests, and the answer formatter tests. Their cases stay, and gain cases for an audio question with and without choices, asserting that the phone, the big screen and the editor agree. The per-surface maps are internal to those modules and get no tests of their own.
- **Backend:** the grading, submit-answer, kahoot speed and live-edit regrade specs pass unchanged. They are the regression net for "no score changes".
- **Prior art:** `scoring.test.ts` and `sort-match.test.ts` for table-driven scoring and pipe-list cases; `question-kind-parity.test.ts` and `question-kind-presentation.test.ts` for tests that walk every question type; `question-csv-round-trip.test.ts` for round trips; `sort-and-match-answers.test.tsx` and `question-display.test.tsx` for surface behaviour.

## Out of Scope

- Reshaping the wire question view into a union by answer kind, or splitting the socket events module (review candidate 4).
- Adding a new question type. This spec makes the next one cheap; it doesn't add one.
- Changing any scoring rule, grading mode, kahoot eligibility (ADR 0001 stands) or the CSV format.
- The big screen's media handling (images, audio, YouTube clips), which doesn't depend on how a question is answered.
- The `/control` and `/remote` presenter views beyond using the shared formatter they already use.

## Further Notes

- Source: candidate 2 ("Question type registry covers each surface, not just the data") of the architecture review dated 2026-10-07.
- The scoring fallthrough is confirmed in the code. Today it is also what keeps closest_guess at zero when it's scored one answer at a time. That path goes away once the number kind has no per-answer score, so check that nothing still scores closest_guess one answer at a time.
- Suggested order:
  1. Pin today's scores and formatted text in tests, then add the answer kind resolver and the answer formats in the shared types, with the Scoring module scoring through them.
  2. Change the answer formatter and the phone's answer inputs to use the formats and a phone map.
  3. The big screen's question and reveal bodies.
  4. The editor's answer section and draft conversion.
  5. Docs.

  Each step leaves the suite green and every surface working.
