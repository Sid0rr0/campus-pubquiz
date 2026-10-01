# 04: CSV encode and decode live in the entries, with a round-trip test

**What to build:** Each entry owns how its question maps to and from the sheet columns, including the YouTube clip start and end seconds carried in the notes column. The backend row decoding and the frontend CSV export both read the entries, so a quiz exported to CSV imports back as the same quiz. The quiz editor's own YouTube clip encoder is deleted.

The CSV column format itself is unchanged.

**Blocked by:** 02 (Import and draft save share one schema).

**Status:** done

- [x] Each entry has encode and decode; import decodes through it and CSV export encodes through it
- [x] A registry spec round-trips every type through export then import, including media, answer media, notes, YouTube clip seconds, match pairs, sort order and `break_after`
- [x] The editor's own YouTube clip encoder is deleted and the editor uses the entry's
- [x] The CSV column format is unchanged, verified by the existing import and sheet specs passing unchanged

## Comments

Implemented in a single commit (see git history for the hash).

- Each `QUESTION_KINDS` entry has a `csv` codec (`question-csv-codec.ts`) with `decode`/`encode` for the type-specific `options`/`answer` cells: `answerOnlyCsv` (free_text, audio, youtube, closest_guess), `choicesCsv` (multiple_choice), `sortCsv`, and `matchCsv`, which owns the `left|…+right|…` packing, the `left+right` answer pairs and the unpaired-answer issue. `decodeSheetRow` (import) and the new `encodeSheetRow` (`question-row-schema.ts`) handle the shared columns and round-level cells around it. The frontend's `quizToCsv` now only orders the columns and escapes cells.
- The YouTube clip line format moved from the quiz editor to `youtubeClipNotes` in `youtube.ts`, exposed as `QUESTION_KINDS.youtube.clipNotes`. The editor reads and writes clips through it.
- `question-csv-round-trip.test.ts` round-trips one fully populated question per type through `encodeSheetRow` → `decodeSheetRow` → `checkQuestion`. It covers media, answer media, notes, clip seconds, match pairs, sort order and `break_after`/category/author. Fields with no column (`questionId`, `matchScoringMode`) are dropped.
- The existing import, sheet and CSV export specs pass unchanged. For answer-only types the `options` cell is no longer decoded or written, but their schemas already stripped it, so imports are unchanged.
