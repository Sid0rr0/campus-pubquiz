# Spec: The question type registry owns each type's scoring modes

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-28, candidate 4 ("Make the question type registry the source of each type's scoring modes", rated *worth exploring*). Builds on `.scratch/sort-scoring-modes/`, which gave sort and match one shared **Scoring mode** vocabulary (see `GLOSSARY.md`).

## Problem Statement

Nothing is broken today. The cost shows up in the next change. Adding the sort scoring modes touched 12 source files, because what a **Scoring mode** means for a question type is spread across five places that each restate it:

- The payload and preview schemas build their `scoringMode` enums from the mode constants (sort uses every mode, match uses the match list), not from the type's registry entry. If the registry entry and the constants drift apart, the editor can show a mode the schema rejects, or the schema can accept a mode the editor never offers.
- Sort's `exact` mode has no scoring branch. It is whatever happens when neither `per_item` nor `one_off` matches. A new mode added to the constants but never given a scorer silently scores as `exact` on stage, and nothing catches it.
- Match's scorer works the same way: `per_item` is the fall-through.
- The quiz editor keeps its own label for each mode. The `/guide` page and `DOCUMENTATION.md` list each type's modes in hand-written text that has to be kept in sync.
- A bad `{scoring: …}` key in a CSV row produces an import error that lists every mode, even for a match question, which doesn't accept `exact`.

A quiz writer or the moderator sees this drift as an editor option the save refuses, a guide line that is out of date, or (worst case) a question scored differently from what its mode says.

## Solution

Each type's registry entry becomes the one declaration of its scoring modes: which modes it accepts (default first), what each is called, and how each one scores. Everything else reads that declaration:

- the payload and preview schemas derive each type's `scoringMode` enum from it;
- the answer format's scorer picks a scoring function for each mode from a table keyed by the mode, so a mode with no scorer is a compile error, not a silent fall-through;
- the quiz editor's Scoring select and the `/guide` page's scoring line take their labels and mode lists from it;
- the CSV import's bad-scoring error names only the modes the row's type accepts.

A parity test pins it down: for every type, the modes the schemas accept are exactly the modes the registry lists.

Users see no change in behaviour: the same modes, the same defaults and the same points. The one visible difference is the corrected CSV error text.

## User Stories

1. As a quiz writer, I want the Scoring select in the quiz editor to offer exactly the modes my question's type accepts, so that I never pick an option the save then refuses.
2. As a quiz writer, I want each scoring mode labelled the same everywhere I meet it (editor, guide), so that I learn the name once.
3. As a quiz writer, I want a sort question left without a mode to score as `one_off` and a match question as `per_item`, as they do today, so that existing quizzes score the same after this change.
4. As a quiz writer importing a CSV, I want a bad `{scoring: …}` value on a match row to tell me the match modes (`per_item`, `one_off`), so that I don't try `exact` and get refused a second time.
5. As a quiz writer importing a CSV, I want a bad `{scoring: …}` value on a sort row to tell me all three sort modes, so that I can fix the row in one go.
6. As a quiz writer importing a CSV, I want the old match names (`partial`, `all_or_nothing`) to keep importing as `per_item` and `one_off`, so that old sheets still work.
7. As a quiz writer, I want a match question given `exact` (by CSV or a crafted save) refused at validation, so that it never reaches a live session.
8. As the moderator, I want the `/guide` page's scoring line to list each type's modes from the same source the editor uses, so that the guide can't fall behind the app.
9. As the moderator, I want a sort answer with exactly two items swapped to still earn half points under `one_off`, so that the refactor doesn't change scores on stage.
10. As the moderator, I want a sort answer with some items in place to still earn its rounded share under `per_item`, so that the refactor doesn't change scores on stage.
11. As the moderator, I want a sort answer that isn't fully right to still score zero under `exact`, so that the refactor doesn't change scores on stage.
12. As the moderator, I want a match answer with one pair wrong to still earn half points under `one_off`, and correct pairs to still earn their share under `per_item`, so that the refactor doesn't change scores on stage.
13. As the moderator, I want a key fix that changes a question's scoring mode to regrade with the new mode's scorer, as it does today, so that live corrections keep working.
14. As a developer adding a scoring mode to a type, I want to touch that type's registry entry and add the mode's scorer, so that the change takes two edits, not twelve.
15. As a developer, I want the build to fail if a type lists a mode that its answer format has no scorer for, so that an unhandled mode can't silently score as `exact`.
16. As a developer, I want the build to fail if a mode has no label, so that the editor never shows a raw mode key.
17. As a developer, I want a test to fail if a type's schema accepts a different set of modes from the one its registry entry lists, so that schema and registry can't drift.
18. As a developer, I want a type without scoring modes to keep rejecting a `scoringMode` field on save and import (it's dropped, as today), so that grading settings stay per type.
19. As a developer, I want the Answer key to keep resolving a question's default mode from the registry's first-listed mode, so that defaults have one home.
20. As a developer reading the scorer, I want each mode's rule in its own named function, so that `exact`, `per_item` and `one_off` read as three rules, not one branchy block.
21. As a developer, I want the existing scoring, answer-kind, answer-key, notes-group and parity tests to pass unchanged (except for the CSV error text), so that I can trust the refactor didn't change behaviour.

## Implementation Decisions

- **Where the per-type mode declaration lives.** The registry module imports the schemas, so the schemas can't import the registry without a cycle. The per-type mode lists therefore stay in the scoring-mode module as one table keyed by question type: each type that has scoring modes maps to its ordered list, default first. A type with no modes is simply missing from the table, or has an empty list. The registry entry's `scoringModes` field reads its value from this table instead of naming a constant. The schemas read the same table. The separate match and sort constants go away, and no other module names a per-type mode list.
- **Labels move to shared types.** The scoring-mode module exports one label per mode, as a `Record<ScoringMode, string>` so a missing label is a compile error. The labels keep the editor's current text ("Exact order only", "Points per item in place", "Half points for one mistake"). The quiz editor drops its own label map and imports this one. A label that has to read differently for sort and match (e.g. "item" versus "pair") is out of scope. Keep today's single label per mode.
- **The scorer is a table, not a fall-through.** The sort and match answer formats each hold a record from each mode the type accepts to a scoring function, typed so that its keys must be exactly that type's modes. The answer format's `score` keeps its shared "fully right is full points" check, then looks up the mode's function. The resolved Answer key always carries a mode, defaulting from the registry, so the lookup never misses. Today's fall-through results are preserved exactly: sort `exact` returns incorrect, match `per_item` returns the rounded share.
- **Schemas derive their enums.** The sort and match payload schemas and preview schemas build `scoringMode` as an enum over that type's entry in the per-type table. Sort ends up accepting the same three modes it does today (its list now comes from the sort entry instead of the all-modes constant), and match keeps accepting two.
- **CSV error text is per type.** The import's invalid-scoring message lists the modes of the row's type, not every mode. The notes-group parser keeps recognising any known mode name or legacy alias. Type-specific rejection stays in the schema, as today.
- **The guide reads the table.** The `/guide` page's scoring sentence is built from the per-type table and the type labels, the same way the page already builds its type list from the registry.
- **Answer key unchanged in shape.** `scoringModesOf`, `isScoringModeOf` and `gradingSettingsOf` keep their signatures and keep reading the registry entry.
- **No schema, migration, protocol or stored-data change.** Mode keys and defaults stay as they are.
- **Docs.** `DOCUMENTATION.md`'s sort and match scoring text and `GLOSSARY.md`'s **Scoring mode** entry describe behaviour that doesn't change, so they need no edit. Update the "Question types are defined once" bullet in `CODING_STANDARDS.md` to name the per-type scoring-mode table and the mode-keyed scorer as the places a new mode goes.

## Testing Decisions

- **Good tests here check behaviour from outside:** a question in, a verdict and points out, or a sheet row in, a verdict or issue out. They never assert on the table's internal shape beyond the one parity check, which is itself the behaviour this spec adds (schema and registry agree).
- **One seam: the shared-types pure functions**, run with Vitest in `shared/types`. No new seam is needed:
  - **Parity:** extend the question-kind parity test with a case per type and mode: every mode the registry lists for a type is accepted by both the import path (`decodeSheetRow`) and the draft-save path (`checkQuestion`), and every known mode it doesn't list is refused by both. This is the drift guard. It is the existing prior art for "both paths reach the same verdict".
  - **Scoring:** the existing `scoring.test.ts` / `answer-kind.test.ts` cases for each sort and match mode must pass unchanged. Add one case if there is none yet: sort with the mode unset scores as `one_off`, match with the mode unset scores as `per_item`.
  - **CSV error text:** a `notes-group` / row-decoding case: a match row with `{scoring: "bogus"}` reports an issue naming `per_item` and `one_off` only, and a sort row names all three.
  - **Guide:** the existing `guide-content` test (frontend, Vitest) gets one assertion that the scoring line names every mode label of each type that has modes, read from the shared table rather than hard-coded.
- The "unhandled mode" and "missing label" guards are compile-time (`pnpm typecheck`). They need no runtime test.
- No backend or e2e tests change. Key-fix regrading goes through the same `scoreSubmission`, and its existing backend specs cover it.

## Out of Scope

- New scoring modes, or new modes for existing types.
- Per-type wording of a mode's label (e.g. "pairs" for match).
- Making the editor's scoring control editable on an opened question. That mismatch between the live-edit guard and the editor is review candidate 3, a separate spec.
- Moving margin (the Number question's other grading setting) into a similar table.
- Any change to defaults, stored payloads, the CSV notes-group syntax or the legacy match aliases.

## Further Notes

- The review rated this *worth exploring*, not *strong*: there's no bug today, and the payoff comes the next time a scoring mode or a graded type is added. If neither is planned soon, this can wait behind candidates 1 to 3.
- The circular import (registry → schemas) is why the per-type table sits in the scoring-mode module and the registry entry reads it, not the other way round. Don't try to make the schemas import the registry.
