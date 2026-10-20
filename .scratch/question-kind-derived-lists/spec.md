# Spec: The question type registry derives every per-type list

Status: ready-for-agent

Source: architecture review 2026-10-20, candidate 6 ("Speculative", in-process).

## Problem Statement

The question type registry is meant to be the one place that says how each question type behaves: its label, its answer input, how it is graded, whether a kahoot round accepts it, which grading settings it carries. Most of the app already reads from it, but a few per-type facts are still copied by hand, and two copies have already gone wrong:

- **Switching a question to Closest guess keeps an answer that can't be saved.** In the quiz editor, changing a question's type to Number clears the answer unless it reads as a number, because a Number key must be one. Closest guess needs a numeric answer too, but the type change only checks "does this type carry a margin", which Closest guess doesn't. So a Free text question with the answer "Paris" switched to Closest guess keeps "Paris", and the quiz master only finds out when the save is refused.
- **The kahoot hint in the editor is hand-written.** When a kahoot round holds a question type kahoot doesn't accept, the round editor says "Kahoot rounds only hold multiple choice, sort, match and number". That sentence is typed out by hand. The backend builds its own refusal message from the registry, with different wording. A change to which types kahoot accepts updates the backend's message but leaves the editor's hint wrong.
- **The lint rule keeps its own copy of the type list.** The rule that bans comparing a question's type against a literal (so behaviour is read from the registry instead) can't import the TypeScript type list, so it holds a hand copy. A test keeps the two equal, but adding a type still means editing the copy.
- **Two registry fields say the same thing.** Every entry has an answer input kind and, separately, whether it carries a list of choices. A type carries choices exactly when its input kind is "choice", so the second field only restates the first. The answer kind resolver reads the choices field first and falls back to the input kind, so the two can only disagree in a way that is silently ignored. A helper that returns a type's input kind has no callers left.

For a developer, adding even a simple question type, one with no settings that reuses an existing answer kind, touches about six files. Two of those are copies kept in sync by hand, and one of the rules ("this type needs a numeric answer") isn't written anywhere at all.

## Solution

Every per-type list and per-type fact is read from, or derived from, the question type registry:

- **"Has a numeric answer key"** is derived from the registry: a type has one when its answer kind is a number. That is true for Number and Closest guess today. The quiz editor's type change, and anything else that asks, uses it.
- **The kahoot type list as people read it** ("multiple choice, sort / order, match pairs and number") is produced once from the registry. The round editor's hint and the backend's refusal message both use it.
- **The lint rule reads the type list** straight from the shared type list's source when the lint config loads, so it holds no copy.
- **The duplicate choices field is removed.** A type's answer kind is its input kind, and the dead helper is deleted.

What changes for users:

- Switching a question to Closest guess clears an answer that isn't a number, as switching to Number already does. A numeric answer is kept.
- The kahoot hint in the round editor lists the accepted types by their registry names, using the same words as the backend's refusal, for example "Kahoot rounds only hold multiple choice, sort / order, match pairs and number questions".
- Nothing else changes.

## User Stories

1. As a quiz master, I want switching a question to Closest guess to clear a text answer, so that I don't find out at save time that the answer must be a number.
2. As a quiz master, I want switching a question to Closest guess to keep an answer that is already a number, so that I don't retype it.
3. As a quiz master, I want switching between Number and Closest guess to keep a numeric answer, so that trying the other type costs nothing.
4. As a quiz master, I want switching a question to Free text, Multiple choice, Sort or Match to keep its answer as today, so that only a type that needs a number ever clears it.
5. As a quiz master, I want the prompt, points and media to survive any type change, as today.
6. As a quiz master, I want the kahoot hint in the round editor to name exactly the types kahoot rounds accept, so that it's never out of date.
7. As a quiz master, I want the hint and the error a save returns to use the same names for those types, so that I'm not left wondering whether they're different lists.
8. As a quiz master, I want the hint to still name the positions of the questions blocking kahoot mode, as today.
9. As a quiz master, I want the type picker to show the same types, in the same order, with the same labels, as today.
10. As a team, I want every question to keep the same answer input on my phone (typed text, number keypad, choices, sort, match), as today.
11. As a team, I want every answer to be scored and shown exactly as today.
12. As a developer adding a question type, I want to state its facts once, in its registry entry, so that no other list needs editing.
13. As a developer adding a numeric question type, I want the editor to clear a non-numeric answer on a type change without my touching the editor, so that the rule follows the answer kind.
14. As a developer changing which types kahoot accepts, I want one registry field to update the backend's refusal and the editor's hint, so that they never disagree.
15. As a developer adding a question type, I want the lint rule to start banning comparisons against it without my editing the lint config, so that the registry stays the only source.
16. As a developer, I want the lint config to fail loudly if it can't read the type list, so that a moved or reshaped list never turns the rule off silently.
17. As a developer, I want each registry fact stated once, so that two fields can't disagree and have one silently win.
18. As a developer, I want no dead helpers on the registry's interface, so that its surface is what callers actually use.
19. As a developer, I want the registry tests to check every derived list against the registry, so that a future hand copy is caught.
20. As a developer, I want the kahoot rule's separate field (free text is kept out although it grades itself on a match, per ADR 0001) left as it is, so that this change doesn't reopen that decision.

## Implementation Decisions

### Registry facts

- **The choices field is removed** from the registry entry. A type's answer kind is its input kind. The answer kind resolver reads the input kind only, and its comment stops describing a choices rule. Today only Multiple choice has a "choice" input kind, and it is the only type whose choices field says "required", so no type's answer kind changes.
- **The helper that returns a type's input kind is deleted.** It has no callers. The answer kind resolver is the one way to get a type's answer kind.
- **Numeric answer key:** a new registry helper beside the other per-type helpers in the Scoring module says whether a type's answer key is a number. It is derived from the answer kind (true when the kind is "number"), not stored as a field. Today it is true for Number and Closest guess.
- **Kahoot accepts** stays its own field, per ADR 0001. It is never derived from the grading mode.

### Lists derived from the registry

- **Kahoot type names:** one shared function returns the types a kahoot round accepts, as a readable list. Each type's label is lowercased, separated by commas, with "and" before the last, in the type picker's order. The backend's refusal message and the round editor's hint both use it. The backend message changes only in that its list now uses "and" before the last item.
- **The editor's type change** clears the answer when the new type has a numeric answer key and the answer doesn't read as a number. That replaces today's check for whether the new type carries a margin. Otherwise it behaves as today.
- **The lint rule's type list:** when the lint config loads, the rule parses the shared type list module with the TypeScript ESLint parser the repo already has. It reads the elements of the type list's array literal.
  - If the module can't be read, the list isn't found, or an element isn't a plain string, loading the config throws with a message naming the module. The rule never runs with an empty list.
  - The hand copy is deleted.
  - The rule's selectors and message are unchanged.

### After this change, a new question type touches

- the type list;
- its registry entry;
- its preview and payload schemas (and a CSV codec, unless it reuses one);
- a new answer kind's format, only if it needs a new answer kind.

No lint config, editor copy or second registry field needs editing.

### Docs, in the same change

- **DOCUMENTATION.md:** the question types section says the registry is the one source for these facts, and that a type needs a numeric answer when its answer kind is a number. The quiz editor section says a type change clears a non-numeric answer for Number and Closest guess.
- **CODING_STANDARDS.md:** the question type registry rule notes that the lint rule reads the type list from source, so adding a type needs no lint change.
- **The `/guide` page:** if it describes switching a question's type, it mentions that Closest guess clears a non-numeric answer, as Number does. Otherwise no change.
- No GLOSSARY change: no new domain term.

## Testing Decisions

- **What makes a good test:** it calls the registry's helpers or the editor's draft functions with plain inputs and checks what they return. It never asserts on how an entry is laid out or which internal function produced a list.
- **Seam: the existing registry tests in shared types, plus the existing editor draft spec.** No new seam.
- **Registry parity tests** gain cases:
  - the numeric-answer-key helper is true for exactly the types whose answer kind is a number (Number and Closest guess today) and false for the rest;
  - every type's answer kind equals its input kind;
  - the kahoot type names list names exactly the kahoot-accepted types, by lowercased label, in the type picker's order, with "and" before the last;
  - the existing "agrees with the Scoring module lists" and ADR 0001 cases stay.
- **The lint rule test** checks that the list the rule parses from source equals the shared type list, replacing the check against the hand copy. It also checks that loading the rule against a module with no type list throws.
- **Editor draft spec** (Vitest) gains cases:
  - Free text with a text answer switched to Closest guess clears the answer;
  - Free text with a numeric answer switched to Closest guess keeps it;
  - Number switched to Closest guess, and back, keeps a numeric answer;
  - switching to a type without a numeric key keeps the answer.
  - The existing switch-to-Number cases stay.
- **Round editor:** the existing quiz editor panel spec checks that the kahoot hint names the types from the shared list, not a hard-coded sentence.
- **Backend:** the existing quiz draft schema cases for a refused kahoot round are updated to the new list wording.
- **Prior art:**
  - the question kind parity and presentation tests in shared types;
  - the existing lint rule test;
  - the editor draft state spec's type change cases.
- E2E: none needed. Run `pnpm e2e` once before the PR if the editor flows are touched.

## Out of Scope

- Deriving the kahoot rule from the grading mode (ADR 0001 keeps it a separate field).
- Generating the preview, payload or CSV schemas from the registry (architecture review candidate 2, the Question record module).
- Changing the type picker's order, the labels or the moderator notes.
- Clearing or converting other fields on a type change (options, match pairs, margin, clip times) beyond the numeric answer rule.
- A lint rule for other per-type literals such as answer kinds or grading modes.

## Further Notes

- Decisions confirmed with the user on 2026-10-20:
  - test through the existing registry tests and the editor draft spec, with no new seam;
  - the lint rule parses the type list from source when the config loads;
  - "has a numeric answer key" is derived from the answer kind, not stored as a new field.
- The review suggested a registry field for the numeric key. Deriving it from the answer kind was chosen because it keeps one fact in one place: a future numeric type gets the rule by choosing the number answer kind.
