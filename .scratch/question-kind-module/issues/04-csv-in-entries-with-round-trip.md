# 04: CSV encode and decode live in the entries, with a round-trip test

**What to build:** Each entry owns how its question maps to and from the sheet columns, including the YouTube clip start and end seconds carried in the notes column. The backend row decoding and the frontend CSV export both read the entries, so a quiz exported to CSV imports back as the same quiz. The quiz editor's own YouTube clip encoder is deleted.

The CSV column format itself is unchanged.

**Blocked by:** 02 (Import and draft save share one schema).

**Status:** ready-for-agent

- [ ] Each entry has encode and decode; import decodes through it and CSV export encodes through it
- [ ] A registry spec round-trips every type through export then import, including media, answer media, notes, YouTube clip seconds, match pairs, sort order and `break_after`
- [ ] The editor's own YouTube clip encoder is deleted and the editor uses the entry's
- [ ] The CSV column format is unchanged, verified by the existing import and sheet specs passing unchanged
