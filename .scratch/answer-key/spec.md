# Spec: One Answer key — what an answer is graded against, defaults filled in once

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-13, candidate 2 ("Make the answer key one value, not loose fields").

## Problem Statement

What an answer is graded against is the question's correct answer, its points, and its type's grading settings: a match question's scoring mode and a Number question's margin. Nowhere is that one thing. It travels as loose optional fields, and each consumer fills in the defaults its own way.

- **A live save can wipe a match question's overrides when nothing changed.** A match question imported from CSV has no stored scoring mode (CSV can't set one; unset behaves as `partial`). The quiz editor loads it as `partial` and saves `partial` explicitly. The live-edit guard compares the stored and incoming fields as raw JSON, so it treats "unset" and `partial` as different. It then marks the opened question for a key fix, and the rescore overwrites every per-answer override on it, such as adjusted partial credit.
  - The trigger is any unrelated save during a live session, for example fixing a typo in a later round.
  - A throwaway probe against the live-edit guard confirmed this: an opened match question with no stored scoring mode, saved with `partial`, is returned for a regrade.
  - Margin had the same bug and got a special case during the number-question review. Scoring mode didn't.
- **"Unset means the default" is resolved in many places.**
  - The margin default is applied separately by Scoring's number answer format, the live-edit guard, the phone's and big screen's margin text, the big screen's Number reveal, and the quiz editor's load.
  - The match scoring mode default is applied by Scoring's match answer format and by the quiz editor's load.
  - Each consumer has to remember to do it, and the live-edit guard forgot one.
- **The set of grading inputs is restated by hand.** Scoring's question shape, the answer formats' keyed-question shape, the live-edit guard's list of grading fields and the answer module's submit each list answer, points, scoring mode and margin. The next per-type grading setting has to be threaded through all of them, and the guard's equality check would need another special case.

## Solution

An **Answer key** module in shared, next to Scoring. Built from any question shape, it gives back what the question is graded against, with the type's settings resolved: defaults filled in, and settings the type doesn't carry dropped. It also says whether two answer keys grade the same.

- **Scoring** resolves the Answer key once at its interface, so every answer format reads a complete key and nothing inside Scoring falls back to a default.
- **The live-edit guard** decides a key fix by asking whether the stored and incoming questions have the same Answer key. This fixes the match bug and retires the margin special case.
- **The phone, the big screen and the quiz editor** read a question's grading settings through the same module, so all of them use one definition of the defaults.

Visible change: an unrelated live save no longer wipes the overrides on an opened match question imported from CSV. Grades, the wire format, the database and the CSV format don't change.

## User Stories

1. As a quiz master who adjusted partial credit on a CSV-imported match question, I want to fix a typo in a later round during the quiz without losing my adjustments, so that saving the quiz doesn't silently change scores.
2. As a quiz master, I want a live save that changes nothing about an opened question's answer key to leave its grades alone, whatever the stored question left unset.
3. As a quiz master, I want an opened match question's scoring mode, changed from partial to all or nothing, still to trigger a key fix and rescore its answers, as today.
4. As a quiz master, I want an opened Number question's margin change still to trigger a key fix, as today.
5. As a quiz master, I want an older Number question with no stored margin, saved with the default margin, not to trigger a key fix, as today.
6. As a quiz master, I want a margin saved with its fields in a different order not to trigger a key fix, as today.
7. As a quiz master, I want an opened question's answer or points change still to trigger a key fix, as today.
8. As a quiz master, I want a setting a type doesn't use (e.g. a margin left on a match question) never to trigger a key fix.
9. As a team answering a Number question, I want my answer graded against the stored margin, or the 10% default when none is stored, as today.
10. As a team answering a match question, I want my pairing scored by the stored scoring mode, or partial when none is stored, as today.
11. As a team, I want my phone to show the same margin ("within 10%") that grading uses, as today.
12. As a room watching the big screen, I want the Number reveal's accepted range to use the margin grading used, as today.
13. As a quiz master editing a Number question with no stored margin, I want the editor to show the default margin grading will use, as today.
14. As a quiz master editing a CSV-imported match question, I want the editor to show the scoring mode grading will use, as today.
15. As a developer adding a grading setting to a question type, I want to declare it once, in the registry entry and the Answer key, and have Scoring, the live-edit guard and every surface pick it up, so that I can't forget one consumer.
16. As a developer, I want "do these two questions grade the same" defined once, so that the key-fix trigger can't drift from what Scoring reads.
17. As a developer, I want a table test of every question type's resolved Answer key, so that the defaults are written down in one place.
18. As a developer reading Scoring, I want answer formats to read a complete key, with no `??` defaults.

## Implementation Decisions

- **New module: the Answer key**, in shared next to Scoring, pure. Its interface is three functions:
  - _grading settings of a question_: type plus any optional settings → the type's resolved settings. A match question gets its scoring mode (default `partial`), a Number question its margin (default the 10% margin), and every other type nothing. Works on any question shape, including a `QuestionView` that carries no answer.
  - _answer key of a question_: type, answer, points and optional settings → `{ answer, points }` plus the resolved settings. This is the one value an answer is graded against.
  - _same answer key_: two answer keys → whether they grade the same. It compares answer, points and the resolved settings by value, so a margin compares by value and unit regardless of field order.
- **The registry entry declares which grading settings its type carries**, replacing the boolean `hasMargin` with a declaration that also covers match's scoring mode. `hasMarginType` keeps its interface and reads the new declaration. The Answer key reads the declaration to decide which settings to resolve and which to drop. No `.type === '<literal>'` checks (CODING_STANDARDS lint rule).
- **The default values stay where they are** (the default margin constant, `partial` for match). The Answer key is the only place that applies them to a question that has no stored setting. Other uses stay: the preview schema's import-time default for a new row, and the quiz editor's initial values for a brand-new question. Those set a value; they don't interpret a missing one.
- **Scoring resolves once at its interface.** Its public functions keep accepting today's question shape, so no call site changes. They resolve the Answer key on entry and hand it to the answer formats. The answer formats' keyed-question type becomes the Answer key with required settings, and the `?? DEFAULT_MARGIN` and "undefined behaves as partial" fallbacks inside the formats go.
- **The live-edit guard's key-fix selection** compares the Answer key of the stored and incoming question, instead of diffing a list of grading fields. The grading-field list, the margin-only equality special case and the effective-margin helper go. The opened-question structure check (type, choices, match targets) is unchanged. A type change on an opened question is still refused, so both keys always have the same type.
- **The answer module's submit** builds the question it grades through the Answer key, instead of naming `matchScoringMode` and `margin` itself.
- **Surfaces read settings through the Answer key:**
  - the phone's and big screen's margin text, and the big screen's Number reveal, take the resolved margin instead of defaulting it;
  - the quiz editor's load reads the margin and scoring mode it shows from the Answer key, instead of `?? DEFAULT_MARGIN` and `?? 'partial'`.
- **Not changed:**
  - **What is stored.** The quiz save still writes the payload as given, so "unset" and `partial` can both be stored. Reads resolve them the same, so either is correct.
  - **The quiz service's payload ↔ draft mapping.** It copies every payload field, not only grading settings.
  - **The wire format.** `QuestionView` still carries an optional margin.
  - **Schema, migrations and the CSV columns.**
- **Docs, in the same change:**
  - `GLOSSARY.md`: add **Answer key**: "What an answer is graded against: the correct answer, the points, and the question type's grading settings (a match question's scoring mode, a Number question's margin), with any setting left unset filled in with its default. A key fix is a change to an opened question's answer key." _Avoid_: grading fields, key fields.
  - `DOCUMENTATION.md`: the live-edit section that lists which changes trigger a regrade says they are compared as Answer keys with defaults filled in, so a setting that is unset and one saved as its default are the same.
  - `CODING_STANDARDS.md`: in "Question types are defined once", say that a question's grading settings are read through the Answer key, never by defaulting an optional field at the call site.
  - The `/guide` page needs no change.

## Testing Decisions

- **Three seams: the Answer key module (new, pure), the live-edit guard's key-fix selection (existing, pure), and the real-store gateway harness (existing).** A good test asserts what a question grades against, whether a save is a key fix, or what `/control` and the phones end up with. It never asserts which helper filled in a default.
- **The bug reproducers go first, red against today's code:**
  - _Live-edit guard spec:_ an opened match question with no stored scoring mode, saved with `partial` and nothing else changed, is not selected for a regrade. Today it is.
  - _Gateway, live edit regrade spec:_ a CSV-shaped match question (no stored scoring mode) is opened. A team answers, and the quiz master overrides the partial credit. A save that only changes a question in a later round leaves the override in place, sends no key-fix answer lists or team syncs for that question, and leaves the leaderboard unchanged.
- **New: an Answer key table spec** in shared (Vitest), built from the registry so a new question type needs no new row. For every type it covers the resolved settings with none stored, with each setting stored, and with a setting the type doesn't carry (dropped). It covers _same answer key_ for: unset vs default (same); margin fields in another order (same); different scoring mode, margin, answer or points (different); and a setting the type doesn't carry differing (same).
- **Regression net that must pass unchanged:**
  - Scoring's tables (`scoring.test.ts`, `number-question-margin.test.ts`, `scoring-pinned-base-scores.test.ts`, `answer-kind.test.ts`);
  - the live-edit guard spec's margin and scoring-mode cases;
  - the live edit regrade and quiz edited gateway specs;
  - the frontend margin-text, reveal and quiz draft state tests.
- **Prior art:** `number-question-margin.test.ts` and `question-kind-parity.test.ts` for registry-driven tables in shared; the live-edit guard spec's `number margin` block for stored-vs-incoming cases; `live-edit-regrade.spec.ts` for a per-type key-fix setup through the gateway.

## Out of Scope

- The Grading policy (`grading-mode-policy` spec). It keeps taking today's question shape. Both specs touch the answer module's submit, which is one line here, so whichever lands second rebases. Neither blocks the other.
- Making `QuestionView` / `RevealQuestionView` carry resolved settings, or discriminating them by type, so that the frontend's settings type is non-optional. That's a wire change.
- Normalising stored payloads, e.g. a migration that writes the default into every row with no stored setting.
- Reworking the quiz service's payload ↔ draft mapping.
- A CSV column for scoring mode or margin.

## Further Notes

- The match bug sits in the live save path. The quiz editor always sends an explicit scoring mode for a match question, so any live save of a quiz with an opened, CSV-imported match question triggers it. A quiz built entirely in the editor isn't affected, because its stored mode is already explicit. Rescoring without overrides gives the same points, so only quiz masters who adjusted partial credit lose anything. That fits with nobody having reported it.
- The review counted 6 margin-default sites. After this spec, the margin default is applied in two places: the Answer key, and the import-time and new-question defaults. Those two set a value rather than interpret a missing one.
