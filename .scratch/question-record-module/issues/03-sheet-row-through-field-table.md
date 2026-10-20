# 03: The CSV row's media and clip half goes through the field table

**What to build:** Exporting a quiz to CSV and importing it again brings every CSV-carried field back the same, for every question type and media kind. The decision of which clip fields go into or come out of a CSV notes cell now comes from the codec's field table, not from separate copies of the rule in the sheet row encoder and decoder. Sheets written today import exactly as before:

- the clip and hidden-video flag are read only for a video question media;
- the reveal clip is read for either video.

Parent spec: `.scratch/question-record-module/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Sheet row encode and decode take the media and clip fields from the field table. The sheet row module's own copies of the clip rule are deleted.
- [ ] These stay as they are:
  - each answer kind's options and answer cell codec;
  - the round-level cells;
  - the sheet-only issues (a match answer not written as pairs, a clip time that isn't a timecode);
  - the mapping from preview field names to sheet column names.
- [ ] The table-driven round-trip spec gains a preview → sheet row → preview leg for every type and media kind. Overlapping cases in the existing CSV round-trip test are folded in, and its sheet-issue and column-name cases stay.
- [ ] GLOSSARY.md **Question record codec** says:
  - it converts between the stored row, the preview, the seeded question and the sheet row;
  - one field table decides when each shape carries a field;
  - the editor asks it for the media and clip rule.
- [ ] Typecheck, lint and tests pass.
