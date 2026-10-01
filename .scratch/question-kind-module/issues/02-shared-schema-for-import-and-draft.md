# 02: Import and draft save share one schema

**What to build:** Import decodes each row and then validates it with the entry's schema; draft save validates with the very same schema, replacing the second validation union. Where the two disagreed, the stricter rule wins. A quiz that previews cleanly in import can no longer fail on save.

The sheet parser keeps owning tokenising, headers, round grouping and forcing `break_after` on the last round. Import error messages keep naming the row and the field.

**Blocked by:** 01 (Registry skeleton with parity and characterization table).

**Status:** done

- [x] Import and draft validation use one schema per type; the second validation union is deleted
- [x] The named divergences in the parity table now assert identical verdicts and messages on both paths (stricter rule)
- [x] A quiz that passes import preview also passes draft save, for every type, in the parity table
- [x] Import errors for a bad row still name the row and field, and an unknown type gives a clear per-row message
- [x] Existing import and draft specs pass; any spec that exercised the looser path gains the stricter case instead of being loosened

## Comments

Implemented in a single commit (see git history for the hash).

- Each `QUESTION_KINDS` entry now has one `schema` (the former draft schema, over `ImportQuestionPreview`); `importSchema`/`draftSchema`, the per-type row schemas and both validation unions (`questionRowSchema`, `questionPreviewSchema`) are gone. `checkQuestion` (`question-kind.ts`) validates a candidate by its type, and an unknown type is an issue on `type`, not a throw. Draft save and import both call it.
- Import: `decodeSheetRow` now yields the round-level cells (checked by the small sheet-only `sheetRowMetaSchema`: round name, `break_after`) plus an `ImportQuestionPreview`-shaped candidate; `sheetFieldForIssue` maps issue paths back to sheet columns (`prompt`→`question`, `mediaUrl`→`media_url`, `matchTargets`→`match_right`, a left/right length mismatch→`options`) so errors still name row and field. Sort and match answers are normalised in decode, so the backend no longer rebuilds them after parsing.
- Stricter rule wins: duplicate multiple-choice options now fail import; repeated left or right items in a match now fail draft save (`options` / `answer` fields). The two named divergences became ordinary cases in the parity table, which now asserts one verdict and identical messages on both paths.
- One sheet-only check stays outside the shared schema: a match answer written as a bare right-hand list (no `left+right` pairs) is a valid draft answer but still rejected on import, reported on `answer` (`sheetAnswerIssue`), since a sheet author who skips the pairs has not written what the format asks for.
- Error wording is now the shared schema's, so import messages lost the "pipe-separated" hints (e.g. "Provide at least two options").
- Specs added for the stricter cases: duplicate multiple-choice options on import, repeated left/right match items on draft save, and the bare match answer on import.
