# 03: Round notes in CSV import, export and the sample sheet

**What to build:** Two optional round-level CSV columns, `round_note` and `show_round_note`, read on import and written on export. The sample import CSV shows how to use them.

- New columns at the end of the sheet row format: `... | category | author | round_note | show_round_note`. Sheets without them still import.
- Round-level like `category` and `author`: the first non-blank cell seen for a round wins (`question-row-schema.ts` / `question-row.schema.ts` / `sheet-csv.parser.ts`). `show_round_note` is `''`/`0`/`1`.
- A note over `ROUND_NOTE_MAX_LENGTH` is reported as invalid on its `round_note` cell. `show_round_note=1` with an empty note is accepted and has no effect.
- Export (`apps/frontend/app/lib/quiz-csv-export.ts`) writes both on a round's last row, with `show_round_note` blank when off.
- `apps/frontend/public/sample-quiz-import.csv` gains both columns: at least one round with a host-only note and one with the note shown on screen.
- Docs: DOCUMENTATION.md (the sheet row format, the round-level cells paragraph, the CSV export mechanics). `/guide`: if it describes CSV columns, add both.

See the spec's "CSV" decision.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Shared/backend test: `round_note` and `show_round_note` are resolved per round (first non-blank wins, on any row of the round).
- [ ] Test: a 501-character `round_note` is an issue on that cell. An empty note with `show_round_note=1` imports with no note.
- [ ] Test: a sheet without the two columns imports as before.
- [ ] Export → import round trip keeps the note and the setting.
- [ ] The sample CSV imports cleanly (an existing sample-import test covers it, or add one).
- [ ] `pnpm typecheck`, `pnpm lint`, and the backend/frontend/shared-types tests pass.
