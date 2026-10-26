# Spec: Scoring modes for sort questions, one shared vocabulary with match

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-10-26 ("different scoring modes for sort questions"). The **Scoring mode** term in `GLOSSARY.md` was settled in that session.

## Problem Statement

A sort question is all or nothing. A team that puts nine of ten items in the right place scores the same as a team that put them in at random. Quiz writers who want to reward a near miss on a long ordering question can't do that, so they avoid long sort questions or split them up.

Match questions already have a scoring mode, but their names don't say what they do. `all_or_nothing` actually gives half points when one pair is wrong, and `partial` is also the name of a verdict. A writer who learns match's names learns nothing that carries over to sort.

At reveal, a team's phone shows its order coloured by the verdict, plus the correct order. Working out which items they had wrong means comparing two arrow chains by eye.

## Solution

Sort questions get a **scoring mode**, using the same three names that match now uses:

| Mode       | Sort                                                                                | Match                                                     |
| ---------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `exact`    | Full points only for the exact order. **Sort's default**, so it scores as today     | Not offered                                               |
| `per_item` | The points shared out over the items in their correct slot                          | The points shared out over correct pairs. **Match's default** (was `partial`) |
| `one_off`  | Half points when the order is exactly two items swapped (any two), otherwise 0      | Half points when exactly one pair is wrong (was `all_or_nothing`) |

Quiz writers set the mode in the quiz editor, or in the CSV notes group as `scoring: "per_item"`. The old match names `partial` and `all_or_nothing` are still accepted on import. Questions already stored are renamed by a migration, and export writes only the new names.

At reveal, the phone shows the team's sort order with a ✓ or ✗ on each item for whether it's in its correct slot, above the correct order.

## User Stories

1. As a quiz writer, I want to set a sort question's scoring mode to `per_item`, so that teams earn a share of the points for each item they place correctly.
2. As a quiz writer, I want to set a sort question's scoring mode to `one_off`, so that a team that swapped just two items gets half points.
3. As a quiz writer, I want a sort question with no scoring mode to score exactly as it does today, so that none of my existing quizzes change.
4. As a quiz writer, I want to write `scoring: "per_item"`, `"one_off"` or `"exact"` in a sort question's notes `{…}` group in the CSV, so that I can set the mode from my sheet.
5. As a quiz writer, I want import to refuse a sort row whose `scoring:` value isn't a sort mode, so that a typo doesn't silently fall back to the default on stage.
6. As a quiz writer, I want import to refuse `scoring: "exact"` on a match row, so that I'm not misled into thinking match supports it.
7. As a quiz writer with an existing sheet, I want `scoring: "partial"` and `scoring: "all_or_nothing"` on match rows to keep importing, read as `per_item` and `one_off`, so that my old sheets still work.
8. As a quiz writer, I want the export to write the new names, so that the sheets I re-download use the current vocabulary.
9. As a quiz writer, I want match and sort to use the same names for the same idea, so that I learn three words instead of five.
10. As a quiz writer in the quiz editor, I want a scoring-mode picker on sort questions like the one on match questions, so that I can set the mode without editing a CSV.
11. As a quiz writer, I want the picker to offer only the modes that question type accepts, with plain labels ("Exact order only", "Points per item in place", "Half points for one mistake"), so that I can't pick a mode that doesn't apply.
12. As a quiz writer, I want the picker to show the type's default when the mode is unset, so that I know how the question will score.
13. As a quiz writer, I want a match question I set to `partial` or `all_or_nothing` before this change to show up as `per_item` or `one_off` and score the same, so that nothing I wrote changes behaviour.
14. As a team, I want my sort answer scored the moment I submit it, as today, so that the scoring mode doesn't change when my verdict is known.
15. As a team, I want a part-right sort answer under `per_item` to earn points rounded to the nearest half point, so that the points match what match questions give.
16. As a team, I want a part-right sort answer to get the verdict `partial`, a fully right one `correct`, and one scoring 0 `incorrect`, so that my phone's colour tells me how I did.
17. As a team in a kahoot round, I want speed to scale my partial sort points as it scales other points, so that a fast near miss still beats a slow near miss.
18. As a team at reveal, I want each item of my submitted sort order marked ✓ or ✗ for whether it's in its correct slot, so that I can see which items I got wrong without comparing two lists.
19. As a team at reveal, I want those marks shown in every sort mode, so that I see what I got wrong even when the mode is `exact` and I scored 0.
20. As a team, I want the marks only once the question is revealed (including when I browse back to it afterwards), and never during the break before its reveal, so that the phone never gives the answer away early.
21. As a team that didn't answer, or answered "I don't know", I want no marks shown, so that the phone doesn't mark an order I never gave.
22. As a team whose answer the moderator overrode, I want the marks to still show which items were in place while the points and colour follow the override, so that the marks always describe my order and the score always matches the leaderboard.
23. As a moderator, I want changing a shown sort question's scoring mode during a live session to re-score every answer to it, like any other key fix, so that the leaderboard reflects the mode I chose.
24. As a moderator, I accept that such a re-score discards manual overrides on that question, as it already does for match, so that there's one rule to remember.
25. As a moderator, I want manual grading of sort answers to work as today, so that I can still hand out any points I like.
26. As an admin, I want the stats pages' correct rate to count a `per_item` sort answer by its share of the points, as it already does for partial match answers, so that the figures stay consistent.
27. As a developer, I want one setting, `scoringMode`, that sort and match both carry, with each type's default given by its answer key, so that there's no second setting to keep in sync.
28. As a developer, I want the rules for every mode decided in one place in Scoring, so that the phone marks, the live score and the key-fix re-score can't disagree.

## Implementation Decisions

- **One grading setting, renamed.** The grading setting `matchScoringMode` becomes `scoringMode`. The question type registry lists it in the grading settings of both sort and match. The match-only scoring-mode module becomes the one declaration of the three mode values (`exact`, `per_item`, `one_off`) and of which values each type accepts: sort accepts all three, match accepts `per_item` and `one_off`.
- **Defaults per type.** Today the Answer key fills each unset setting from one default per setting name. `scoringMode`'s default now depends on the question type: `exact` for sort and `per_item` for match. The Answer key stays the only place defaults are filled in. The question record codec and every other shape keep "unset stays unset".
- **Scoring.** The sort answer format scores by the resolved key's `scoringMode`:
  - `exact`: today's comparison (split pipe list, stray whitespace and empty items ignored).
  - `per_item`: points × (items whose slot matches) ÷ (item count), kept to the nearest half point. Verdict `partial` when 0 < points < full, `incorrect` when no item is in place.
  - `one_off`: Half points (`halfPoints`) when exactly two slots differ and those two items are each other's correct item; otherwise `incorrect`. Two identical items swapped already counts as exact.

  The match format's logic doesn't change; it now reads `per_item` and `one_off` in place of `partial` and `all_or_nothing`.
- **One per-slot comparison.** A pure function in shared types compares a submitted sort value with the key slot by slot, using the same split and trim as scoring, and returns one in-place flag per submitted item. The `per_item` score and the phone marks both use it, so they can't disagree.
- **Payload schema.** The sort and match payload schemas each accept `scoringMode` limited to that type's values. Saving a value the type doesn't accept is refused at the boundary, in the editor and in the REST save path, as an unaccepted margin is today.
- **The CSV notes group.** `scoring:` is read into `scoringMode`. The old values `partial` and `all_or_nothing` are read as `per_item` and `one_off` (for any type; they only ever existed on match). Any other unreadable value is reported as unreadable, as today. Whether the type accepts the value is checked by the import's per-type validation, which rejects the row. Serializing writes only the new names.
- **Migration.** A MikroORM migration on the `questions` table, the only store of question payloads:
  - renames the payload key `matchScoringMode` to `scoringMode`;
  - rewrites the values `partial` → `per_item` and `all_or_nothing` → `one_off`.

  `down` reverses this for match rows and drops `scoringMode` from sort rows.
- **Question views and the key fix.** The admin and moderator question views carry `scoringMode` in place of `matchScoringMode`. Live edit treats a `scoringMode` change on a sort question as a key fix exactly as it does for match today: the Grading policy's key-fix event re-scores every answer and discards overrides. Nothing new there.
- **Phone reveal.** When the `/play` question browser is in revealing mode for a sort question and the team has a real answer (not blank, not "I don't know"), "Your answer" renders the team's order as a list of items, each marked ✓ or ✗ by the per-slot comparison against the revealed answer. The players' view already carries the correct answer at reveal, so the protocol doesn't change. The verdict colour and the points line stay as they are.
- **The editor picker.** The quiz editor's scoring-mode control is offered for sort and match. It lists only the type's accepted modes with the plain labels above, and shows the type's default when unset. The draft state carries `scoringMode`.
- **Docs, in the same change:**
  - `DOCUMENTATION.md`: the sort and match type sections, the notes-group `scoring:` values and aliases, the `/play` reveal row, and the key-fix list of grading settings.
  - CLAUDE.md's "Live answer-key fixes overwrite manual overrides" tradeoff: "adjusted `match` partial credit" becomes "adjusted `per_item` credit on a sort or match question".
  - The `/guide` page, if it describes the editor's scoring mode or the phone reveal.
  - `GLOSSARY.md` already has the term.

## Testing Decisions

- Test external behaviour only: what a submission scores, what import accepts and produces, what the database holds after migrating, what the phone shows. Don't test helper functions or internal shapes.
- **Scoring (`scoreSubmission`).** For sort:
  - each mode on a right, a part-right, a two-swapped and a shifted-by-one order;
  - rounding to the nearest half point;
  - verdicts;
  - kahoot speed scaling of partial points;
  - unset behaving as `exact`.

  For match, `per_item` and `one_off` give exactly what `partial` and `all_or_nothing` gave. Prior art: `scoring.test.ts` and `scoring-pinned-base-scores.test.ts`.
- **The CSV import boundary and round trip.**
  - Every mode is accepted on the types that take it.
  - `exact` on match and a junk value on sort are rejected.
  - `partial` and `all_or_nothing` are read as the new names.
  - Export → import is lossless and writes only the new names.

  Prior art: `question-import-boundary.test.ts`, `question-csv-round-trip.test.ts`, `notes-group.test.ts`, `question-record-codec.test.ts`.
- **Migration.** A DB-backed spec seeds question rows with old match payloads (both values, plus unset), and a sort row and a free-text row that it must leave alone. It runs the migration and asserts the rewritten payloads. Prior art: `retype-media-questions.spec.ts`.
- **Phone reveal.** A frontend Vitest render test of the question browser:
  - a revealed sort question shows ✓ and ✗ on the right items;
  - no marks before reveal, for no answer, or for "I don't know";
  - marks still shown when the points come from an override.
- **Existing tests renamed, not rewritten.** These follow the field rename and otherwise keep their assertions: `quiz-draft-state.test.ts`, `answer-key.test.ts`, `live-edit-regrade.spec.ts`, `auto-grading.spec.ts`, `question-type-field-validation.spec.ts`. Add one case in the live-edit regrade spec: a sort question's `scoringMode` change re-scores its answers.

## Out of Scope

- An `exact` mode for match.
- ✓/✗ marks for match answers on phones (a follow-up).
- Marks on the big screen.
- An adjacent-pairs mode for sort (considered and dropped).
- Pairwise-order (Kendall) scoring.
- Changing how manual grading, the Grading policy's events or the socket protocol work.

## Further Notes

- A 2-item sort question in `one_off` mode gives half points for the reversed order. That's accepted, since 2-item sort questions are rare.
- In `exact` mode a team can see several ✓ marks yet score 0. That's intended: the marks describe the order, the mode decides the points.
