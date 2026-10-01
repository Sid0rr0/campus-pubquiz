# Spec: One Question kind module per QuestionType

Status: ready-for-agent

## Problem Statement

Everything the app knows about a question type is restated in a different place, and the copies have drifted.

- **A quiz can pass the import preview and then fail on save.** Import and the quiz editor's draft validation are two separate Zod unions. They disagree on duplicate multiple-choice options and on match pairing, so the quiz master sees a green preview, confirms, and gets a validation error — or worse, saves something the other path would have rejected.
- **Adding a question type touches about 25 files.** `QuestionType` is only a union; each reader (import schema, draft schema, scoring lists, payload shapes, CSV writer, editor sections, answer form, display, grading code) carries its own per-type switch or list. Missing one means a crash live on stage rather than a type error.
- **The stored JSON payload is trusted by cast.** Three modules each declare their own `QuestionPayload` interface and read the JSON column with `as`, so a malformed or older row is only found when a game reaches it.
- **The CSV format is split across workspaces.** The backend parses the sheet columns; the frontend writes them back out. Nothing proves a quiz exported to CSV imports back as the same quiz.
- **Per-type literals leak.** Block grading and the answers panel still compare against the literal `closest_guess`, and the quiz editor keeps its own list of question types and its own YouTube clip encoder.
- **The Scoring module's per-type lists live apart from the rest of what a type is.** Auto-graded, batch-graded, human-graded, kahoot-allowed and overridable lists are one concern with the type's schema, but sit in a different file, so adding a type means remembering to update them all.

## Solution

A Question kind module in shared types holds one entry per `QuestionType`. An entry owns everything type-specific:

- its validation schema (one Zod definition, used by import, draft save and persistence);
- how it encodes to and decodes from the CSV columns (including the YouTube clip notes);
- its payload codec — the stored JSON is parsed against the entry, not cast;
- its grading mode (auto, batch, human) and whether it is overridable and kahoot-allowed;
- how many reveal steps it has and which answer input it renders.

Import is "decode the row, then validate with the entry's schema". The editor, CSV export, answer form, display and grading code read the same entry. The Scoring module's per-type lists are derived from, or moved into, the entries. Because import and save share one schema, a quiz that previews cleanly cannot fail on save. Adding a type becomes one new entry plus its input/display component.

ADR 0001 stays respected: "allowed in kahoot rounds" is its own field on each entry and is never derived from "auto-graded" (free_text grades at submit but is deliberately excluded).

## User Stories

1. As a quiz master importing a CSV, I want a green preview to mean the quiz will save, so that I don't get a validation error after confirming.
2. As a quiz master editing a quiz in the editor, I want the same validation rules as import, so that a quiz doesn't change validity depending on how it was entered.
3. As a quiz master, I want duplicate multiple-choice options rejected identically in import and in the editor, so that a question can't have two indistinguishable choices on one path only.
4. As a quiz master, I want match pairing validated identically in import and in the editor, so that a mismatched left/right count is caught at the same moment either way.
5. As a quiz master, I want a sort question's answer to be a reordering of its options in both import and editor validation, so that the question is always solvable.
6. As a quiz master, I want a closest_guess answer that is not a number rejected in both paths, so that the batch grader never meets an unparseable target live.
7. As a quiz master, I want a YouTube question without a valid http(s) link rejected in both paths, so that the display never gets a broken embed.
8. As a quiz master, I want a clipped YouTube question's start and end seconds to mean the same thing in the CSV notes column and in the editor's clip fields, so that a clip survives moving between them.
9. As a quiz master, I want to export a quiz to CSV and import it back as the same quiz, so that I can edit in a spreadsheet without losing anything.
10. As a quiz master, I want every question type to round-trip through CSV export and import, including media, answer media, notes, break_after and match pairs, so that no field is silently dropped.
11. As a quiz master, I want the question type picker in the editor to list exactly the types the system supports, so that I can't pick a type the backend rejects or miss one it accepts.
12. As a quiz master, I want each type's editor fields (options, match pairs, clip times, numeric answer) to appear because the type says so, so that a type's editor always matches what its validation requires.
13. As a quiz master, I want changing a question's type in the editor to drop the fields the new type doesn't use, so that stale options don't get saved onto a free_text question.
14. As a quiz master running a kahoot round, I want only the kahoot-allowed types accepted in that round, so that speed scoring never turns into typing speed.
15. As a quiz master, I want free_text to stay excluded from kahoot rounds even though it auto-grades, so that ADR 0001 keeps holding after the refactor.
16. As a quiz master, I want the per-answer override offered for exactly the types that can be overridden, so that I'm never offered a regrade the server will reject (closest_guess).
17. As a quiz master grading in break, I want human-graded types to show the grading controls and auto-graded ones to show the result, so that I can tell which answers need my judgement.
18. As a quiz master, I want closest_guess to be recognised as batch-graded by the type's entry rather than by a name check, so that its reveal and grading behave consistently on every screen.
19. As a team on a phone, I want the answer input to match the question type (text box, choices, reorder list, pairing, number), so that I can answer the way the question intends.
20. As a team on a phone, I want an old or unusual stored question to still render, so that a bad row doesn't blank my screen mid-quiz.
21. As a quiz master, I want a question row whose stored JSON no longer matches its type's schema to fail loudly when the quiz loads or is edited, not midway through a live game, so that I find out before going on stage.
22. As a quiz master, I want an unknown question type in an import to produce a clear per-row message, so that I know which row to fix.
23. As a quiz master, I want the import error for a bad row to name the row and the field, so that I can fix a long sheet quickly.
24. As a developer, I want to add a question type by adding one registry entry, so that I don't have to find and edit two dozen files.
25. As a developer, I want the compiler to fail when a type has no entry, so that a missing reader is a build error rather than a crash live on stage.
26. As a developer, I want one test that runs the same cases through import validation and draft validation, so that the two can never drift again.
27. As a developer, I want one test that round-trips every type through CSV, so that the exporter and importer stay in sync across workspaces.
28. As a developer, I want the three duplicated payload interfaces replaced by the registry's payload type, so that there is one definition of what is stored per type.
29. As a developer, I want the Scoring module to read grading mode, overridable and kahoot-allowed from the entries, so that a type's scoring facts live beside its schema.
30. As a developer, I want existing scoring, import, draft and CSV behaviour unchanged for valid quizzes, so that this refactor ships without changing any quiz that works today.
31. As a quiz master with existing saved quizzes, I want them to keep loading with no migration, so that the refactor needs no data change.

## Implementation Decisions

- **One Question kind module in shared types.** A registry keyed by `QuestionType`; the type union is derived from (or checked against) the registry's keys so a type without an entry is a compile error, and `QUESTION_TYPES` has a single definition that every workspace imports.
- **Entry interface** covers: validation schema; CSV decode (row columns → question) and encode (question → row columns); payload codec (parse stored JSON → typed payload, serialise typed payload → JSON); grading mode (`auto` / `batch` / `human`); `overridable`; `kahootAllowed` (its own field, never derived — see ADR 0001); reveal step count; answer input kind. Entries are plain data plus pure functions; no I/O.
- **One schema per type**, written once and used by import, draft save and persistence. Where the two current schemas differ, the stricter rule wins for the shared schema; the differences found so far are duplicate multiple-choice options and match pairing. Any other disagreement found while merging is resolved the same way and recorded in the test table.
- **Import = decode, then validate.** The sheet parser keeps owning CSV tokenising, headers, round grouping and `break_after` forcing for the last round; per-type column handling and validation move to the entry. Import error messages keep naming row and field.
- **Draft save validates with the same entries**, replacing the second Zod union.
- **Persistence parses instead of casting.** Reading the JSON payload column goes through the entry's payload codec; the three `QuestionPayload` interfaces are deleted in favour of the registry's payload type. A parse failure on load is a loud, logged error naming the question, not a silent cast.
- **CSV export in the frontend** reads each entry's encode; the quiz editor's own type list and YouTube clip encoder are deleted in favour of the entry's.
- **Scoring module** keeps its scoring functions (pure, in shared types) but its per-type lists (`AUTO_GRADED_TYPES`, `BATCH_GRADED_TYPES`, `HUMAN_GRADED_TYPES`, `KAHOOT_ALLOWED_TYPES`, `OVERRIDABLE_TYPES`) and `is…Type` helpers are derived from entry fields. Their public names and results are unchanged so callers need no change beyond the literal-removal below.
- **Remove per-type literals** in block grading and the answers panel: ask the entry for grading mode instead of comparing to `closest_guess`.
- **Editor and answer/display components** select their section or input by the entry's declared input kind; the components themselves stay per-kind. A new type still needs its own input/display component, but no other file.
- **No schema or migration change.** Stored data and API contracts are unchanged for valid quizzes.
- **Behaviour change limited to the merged schema's strictness**: quizzes valid on only the looser path today become invalid on both. This is the intended fix, and is called out in the test table.

## Testing Decisions

- **One seam: the registry's public interface.** A good test here exercises external behaviour — given these inputs, the entry accepts or rejects them with this message, or encodes/decodes to this value — and never inspects how an entry is built.
- **Table-driven registry spec in shared types**, run over every `QuestionType`:
  - every type has an entry, and entry keys equal the type union;
  - a shared table of valid and invalid questions per type is run through **both** the import path (decode → schema) and the draft path (schema), asserting identical verdicts and messages — this is the test that pins "preview green ⇒ save passes";
  - CSV encode → decode round-trips each type, including media, answer media, notes, YouTube clip seconds, match pairs and sort order;
  - payload codec parses valid stored JSON and rejects malformed JSON for each type;
  - grading mode, overridable and kahoot-allowed per type equal today's values (free_text auto-graded but not kahoot-allowed; closest_guess batch-graded and not overridable; audio/youtube human-graded).
- **Existing specs act as characterization and must keep passing unchanged**: the import parsing specs, the draft-schema and quiz-editor specs, the scoring spec, and the answer and block-grading specs. A failing existing spec means behaviour changed, not that the spec is stale — except where the strictness merge is the intended cause, in which case the spec gains the stricter case rather than being loosened.
- **Prior art:** the Scoring module's table-style spec for per-type rules, the import parsing specs for per-type row cases, and the live-session real-store harness for loading persisted questions.
- No new test seams in the backend or frontend; wiring changes are covered by the existing specs above.

## Out of Scope

- Adding any new question type.
- Changing scoring rules, kahoot eligibility, or grading behaviour for valid quizzes.
- Changing the CSV column format or the Google Sheets import mechanics.
- Database schema changes or data migrations.
- Redesigning the editor, answer form or display layouts beyond selecting them by entry.
- The other architecture-review candidates (Advance plan, effect-returning transition, block grading lifecycle, display on-air rendering, phone identity, stats rules).

## Further Notes

- Source: architecture review of 2026-10-01, candidate 03 (graded "Strong"). The three bugs from the same review were fixed separately and are unrelated to this spec.
- Suggested slicing for tickets, each independently shippable: (1) registry skeleton plus parity test table with the current schemas wrapped as entries; (2) merge import and draft onto the shared schema; (3) payload codec replacing the three payload interfaces and the casts; (4) CSV encode/decode moved into entries with the round-trip test; (5) Scoring lists derived from entries and the `closest_guess` literals removed; (6) editor and answer/display read the entry.
- Parity table cases should include the known disagreements first (duplicate multiple-choice options, match pairing) so they fail before the merge and pass after.
