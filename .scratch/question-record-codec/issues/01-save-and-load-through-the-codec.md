# 01: Save and load a quiz through the question record codec

**What to build:** Opening a quiz in the editor and saving it (from the manual editor or an import confirm) convert each question through one question record codec in shared code, instead of the quiz service copying payload fields one at a time in each direction. The codec copies options, match targets, media, answer media and clip bounds once, and copies grading settings by spreading the ones the question type registry lists for the type, dropping any other. Quiz masters save and reload every question type exactly as today.

Parent spec: `.scratch/question-record-codec/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A pure question record codec sits beside the stored payload codec with two conversions: row (columns plus an already-parsed payload) to preview, and preview to the stored columns and payload a save writes, including the YouTube clip bounds read from the notes.
- [ ] Grading settings cross only for the types the registry lists them on; unset stays unset (no defaults filled in, the Answer key still owns defaults).
- [ ] Parsing still goes through the type's payload codec and the backend's logging wrapper; the codec never casts raw JSON.
- [ ] The quiz service's load-for-editing and save paths call the codec and no longer list payload fields; the summary payload stays a narrow projection of the parsed payload.
- [ ] A shared-types round-trip test, table-driven from the registry, builds a fully populated example per type and asserts row → preview → stored fields gives back the same columns and payload, unset settings stay unset, a stray setting on the wrong type is dropped, and a type with no media/options/settings round-trips with none.
- [ ] The existing quiz service, quiz controller and draft validation specs pass unchanged.
- [ ] GLOSSARY.md defines the question record codec; the CODING_STANDARDS.md grading-settings line says settings are copied across shapes by it.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend and shared-types tests pass.
