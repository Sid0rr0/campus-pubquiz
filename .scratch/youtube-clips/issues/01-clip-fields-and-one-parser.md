# 01: One clip parser and real clip fields (fixes the editor autofill)

**What to build:** Replace the two disagreeing clip readers in `shared/types/src/youtube.ts` with one lenient parser. It reads `start`/`end` (plus `revealStart`/`revealEnd`/`hideVideo` for tickets 02–03) out of the notes and hands back the free notes without the group. The clip becomes a real field on the editor draft and `ImportQuestionPreview`, next to the existing payload `mediaStartSeconds`/`mediaEndSeconds`, instead of living in the notes text.

- CSV import moves the group out of the notes cell into the fields.
- CSV export writes the canonical `{start: "…", end: "…"}` group back into the notes, leaving out empty keys.
- Loading a stored question strips any clip group left in its notes.
- The editor's clip inputs bind to the fields, not to the notes.

After this ticket, importing the sample CSV shows 55 and 88 in the clip inputs.

Parent spec: `.scratch/youtube-clips/spec.md`

**Blocked by:** —

**Status:** done

- [ ] Parser tests: each timecode shape, quoted/unquoted, the legacy `YouTube clip: {…}` line, `{start: "55", end: "88"}`, no group, free notes around the group preserved
- [ ] The parser also reads `revealStart`, `revealEnd` and `hideVideo: true`, so 02 and 03 only add fields and UI
- [ ] `QuestionKind.clipNotes` / `ClipNotesCodec` and `parseYoutubeClipFromNotes` are gone or reduced to the one parser; no second reader remains
- [ ] CSV round trip stable; a question without a clip exports its notes unchanged
- [ ] A stored row with a clip line in its notes loads with the fields set and the line stripped
- [ ] Editor test: the sample CSV's YouTube question fills the clip inputs (regression)
- [ ] `DOCUMENTATION.md`: the YouTube clip paragraph describes the notes group as CSV-only syntax
