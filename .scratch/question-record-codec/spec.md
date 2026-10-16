# Spec: One stored-question codec — a question crosses storage, preview and the seeded game in one place

Status: done

Blocked by: none

Source: architecture review 2026-10-14, candidate 5 ("One stored-question codec", "Worth exploring", in-process).

## Problem Statement

A question exists in three shapes: the stored row (columns plus a JSON payload), the preview the quiz editor and import work with, and the seeded question a live session holds. Every place a question crosses from one shape to another copies its fields by hand, one at a time:

- **Row to preview.** When a quiz is loaded for editing, the quiz service lists every payload field (options, match targets, match scoring mode, margin, media, answer media) and copies each across.
- **Preview to row.** When a quiz is saved, the quiz service lists the same fields again in the other direction. It also reads a YouTube question's clip start and end from its notes.
- **Row to seeded question.** When a session is seeded, the seed service spreads the whole parsed payload onto the question. Whatever the payload holds, including a grading setting the type doesn't carry, rides along.
- **Seeded question to reveal view.** The block reveal views strip the margin off the seeded question and add the resolved one back, because the seeded question might carry a margin on a type that has none.

The editor also keeps its two grading settings in two different places. A match question's scoring mode is loaded and saved by the match answer-kind draft. A Number question's margin is loaded and saved by its own pair of helpers in the editor's draft state, beside the answer drafts and not among them.

For a developer, this means:

- **Adding a field touches many files.** Adding Number's margin touched about twenty: the payload schema, the preview schema, the payload type, both quiz service mappers, the view conversion, the block reveal views, the editor's margin draft and, separately, the match draft's scoring mode. A new grading setting would have to repeat all of it.
- **A missed copy fails silently.** If one mapper forgets a field, the field is lost on save or on load, and nothing fails to compile. The quiz master finds out when a saved setting doesn't come back.
- **The grading settings aren't driven by the registry.** The question type registry already lists each type's grading settings, and the Answer key already reads that list to resolve them. The mappers and the editor ignore it and name each setting by hand.

Quiz masters see no bug today. The cost shows the next time a payload field or grading setting is added.

## Solution

One **question record codec** in shared code, next to the stored payload codec, converts a question between its stored row, its preview and its seeded question. It copies the media fields and options once, and it copies the grading settings by spreading the ones the question type registry lists for the type, so a setting the type doesn't carry never crosses. The quiz service and the seed service call it instead of listing fields. The block reveal views stop stripping the margin, because a seeded question can no longer carry one its type doesn't have.

The editor gets one draft entry per grading setting, in a table keyed by the setting's name. The match scoring mode and the margin are loaded and saved through it, so adding a setting is one entry, and a missing entry fails typecheck.

A round-trip test for each question type proves the codec loses nothing.

Quiz masters, teams and the big screen see no difference. Every question saves, loads, imports, seeds and reveals exactly as today.

## User Stories

1. As a quiz master, I want every question I save to load back in the editor exactly as I saved it, as today, so that editing a quiz never loses work.
2. As a quiz master, I want a match question's scoring mode to survive a save and reload, as today.
3. As a quiz master, I want a Number question's margin (value and unit) to survive a save and reload, as today.
4. As a quiz master, I want a Number question saved before margins existed to load with the default margin, as today.
5. As a quiz master, I want a match question saved before scoring modes existed to load as partial, as today.
6. As a quiz master, I want options, match targets, question media and answer media to survive a save and reload for every type that has them, as today.
7. As a quiz master, I want a YouTube question's clip start and end, written in its notes, to play as configured in a session, as today.
8. As a quiz master, I want an imported CSV or Google Sheet to save exactly what the import preview showed, as today.
9. As a quiz master, I want a session started from a saved quiz to play and grade every question exactly as saved, as today.
10. As a quiz master, I want a live edit to a running quiz to reach the session with every field, as today, so that a key fix grades against what I saved.
11. As a quiz master, I want changing a question's type in the editor to keep or drop its answer exactly as today, so that switching to Number still clears an answer that isn't a number.
12. As a quiz master, I want an unreadable margin in the editor to be refused on save, as today, instead of quietly defaulting.
13. As a team, I want the margin text on my phone and the big screen to stay exactly as today for Number and absent for every other type.
14. As a team, I want the closest_guess reveal and the ordinary reveal to stay exactly as today.
15. As a developer adding a payload field, I want to change the payload schema and the codec, not every mapper, so that the field crosses every boundary at once.
16. As a developer adding a grading setting, I want to add it to the registry's list and its default to the Answer key, and have the codec copy it and the editor fail typecheck until it has a draft entry, so that no boundary is forgotten.
17. As a developer, I want a seeded question never to carry a grading setting its type doesn't have, so that no projection has to strip one.
18. As a developer, I want the block reveal views to add the resolved margin without stripping a stored one first.
19. As a developer, I want the quiz service to read as "load rows, convert, return" and "validate, convert, store", so that the field list lives in one place.
20. As a developer, I want a round-trip test for every question type, driven by the registry, so that a new type or field that the codec misses fails a test.
21. As a developer, I want an editor round-trip test for every question type, so that a grading setting's draft entry that loses a value fails a test.
22. As a developer reading the editor's draft state, I want the grading settings loaded and saved in one place, beside the answer drafts, so that I don't hunt for where the margin lives.
23. As a developer, I want the stored payload still parsed through the type's own payload codec, so that a malformed or old row still fails when the quiz loads rather than live on stage.
24. As a developer, I want the glossary to name the question record codec, so that the term means the same thing in code, specs and conversation.

## Implementation Decisions

- **New module: the question record codec,** in shared code beside the stored payload codec (`parseQuestionPayload`). It is pure, with no database, and has three conversions:
  - **row to preview:** from a stored row's columns (id, type, prompt, answer, points, notes) and its parsed payload, to the editor and import preview
  - **preview to stored fields:** from a preview to the columns and payload a save writes, including the YouTube clip read from the notes
  - **row to seeded question:** from a stored row and its parsed payload to the seeded question a session holds
- **The codec takes an already-parsed payload.** Parsing stays with the stored payload codec, and the backend's logging wrapper that names the bad row stays where it is. The codec never casts raw JSON.
- **Grading settings are spread from the registry.** Every conversion copies exactly the grading settings the question type registry lists for the type, and drops any other setting a source might carry. Unset stays unset: the codec doesn't fill in defaults. The Answer key remains the only place defaults are filled in.
- **Media fields and choice lists are copied once.** Options, match targets, question media, answer media and clip bounds are each named once in the codec, with "absent stays absent" kept exactly as today. The preview carries no clip bounds, which stay in the notes as today; only the stored payload and the seeded question carry them.
- **The quiz service converts through the codec.** Loading a quiz for editing maps rows through "row to preview". Saving a draft (manual editor and import confirm) maps each preview through "preview to stored fields". The summary payload (options and match targets only) stays a narrow projection of the parsed payload, but reads it from the same place.
- **The seed service converts through the codec.** Seeding a session and the hard-coded fixture map rows through "row to seeded question". The comment explaining why the payload's player-safe fields are what reaches the seeded game moves with it.
- **The block reveal views stop stripping the margin.** Since a seeded question carries only its type's settings, the reveal views add the resolved margin (from the Answer key, as today) on top without removing the stored one first. The question view conversion keeps resolving the margin the same way.
- **The editor gets one draft entry per grading setting.** It is a table keyed by grading setting name that every setting must fill (a missing setting fails typecheck), and each entry loads its editor fields from a preview and saves them back. The match scoring mode leaves the match answer-kind draft and becomes an entry. The margin's load and save helpers become an entry, with today's behaviour kept: the default shown for a new question, NaN for an unreadable value so the server refuses it, and nothing saved for a type without a margin. Only the settings the type's registry entry lists are saved.
- **Changing a question's type in the editor is unchanged.** It still reads the registry to decide whether the answer survives.
- **No database or wire change.** The stored payload shape, the preview shape, the seeded question shape and the socket views stay as they are. No migration.
- **Docs to update in the same change:** the glossary (question record codec). DOCUMENTATION.md only if it describes the save or load mapping field by field. CODING_STANDARDS.md's line about grading settings gains "copied across shapes by the question record codec". `/guide` doesn't change.

## Testing Decisions

- **A good test converts a question and checks what comes out, not how.** Assert the shape a round trip produces, not which helper copied which field.
- **Seam 1: the question record codec, round-tripped per question type in shared-types.** The test is table-driven from the question type registry, so a new type is covered automatically. For each type, it builds a fully populated example (every field and grading setting the type allows, plus a YouTube clip in the notes where the type takes media) and asserts:
  - row to preview to stored fields gives back the same columns and payload
  - row to seeded question carries every payload field the type allows, and no grading setting the type doesn't list, even when the source row carries one
  - an unset grading setting stays unset through every conversion
  - a type that takes no media, options or settings round-trips with none
  Prior art: the CSV round-trip test, the stored payload codec test and the Answer key test.
- **Seam 2: the editor's draft state, round-tripped per question type in the frontend.** The existing draft-state suite gains preview to editor question to preview for every type, asserting that the match scoring mode and the margin survive, that a type without a setting saves none, and that an unreadable margin still saves as NaN. Prior art: the existing draft-state tests.
- **The quiz service and seed service specs stay as they are and must keep passing.** They are the behavioural check that the backend wiring changed nothing. No new backend round-trip seam.
- **Type-level coverage.** The editor's grading-setting draft table is a record over every grading setting name, so a new setting fails typecheck until it has an entry. The pre-commit hook and CI already run typecheck.

## Out of Scope

- **The CSV codec.** CSV import and export already go through the registry's per-type CSV codec. It isn't one of the hand-copied mappers.
- **The live-edit guard's list of opened-question fields.** It compares fields for a different purpose (what may change once a question has opened), not to convert shapes.
- **The question view conversion's field list.** It strips the answer for broadcast, so it is a projection, not a conversion. Only its reliance on the margin being clean changes.
- **Changing any stored shape, default or validation rule.**
- **Merging the preview schema and the stored payload schema.** They describe different shapes on purpose.
- **The editor's answer-kind drafts beyond moving the match scoring mode out.**

## Further Notes

- The review rated this "Worth exploring". It earns its keep the next time a payload field or grading setting is added. The Number question work is the evidence: about twenty files for one setting.
- The codec spreads settings from the same registry list the Answer key reads, so the two can't disagree about which settings a type carries. ADR 0003 (Number is its own question type) is respected: the margin stays a property of the Number type in the registry.
- Candidate 4 (the `grading-state` spec) and this spec don't overlap. Both touch the shared types package but not the same modules.
