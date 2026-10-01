# 07: Audio and YouTube questions can carry multiple-choice options

**What to build:** An audio or YouTube question can optionally have a list of choices, with the answer one of them, so teams pick from choices instead of typing. Today those two types have no `options` anywhere: their schemas and stored payloads drop it, the editor only shows choices for `multiple_choice`, and the phone answer form only renders choices when the type is `multiple_choice`. The CSV `options` cell is ignored for them.

Questions without options behave exactly as today (free typed answer, human-graded).

**Blocked by:** 06 (Editor and answer/display select by entry) — the editor and answer form should select the choices input from the entry rather than from a `type === 'multiple_choice'` check, so this ticket adds no new per-type switch.

**Status:** ready-for-agent

- [ ] The audio and youtube preview and payload schemas accept optional `options`; when present they need at least two, no repeats, and the answer must be one of them (the same rules as `multiple_choice`), enforced identically by import and draft save
- [ ] The audio and youtube entries use the `choicesCsv` codec, so `options` survives CSV export then import; the round-trip spec covers an audio and a youtube question with options as well as without
- [ ] The editor offers the choices section for audio and youtube, and a question with no choices still saves
- [ ] The phone answer form shows the choice buttons for an audio or youtube question that has options, and the text box when it has none
- [ ] Grading is unchanged: audio and youtube stay human-graded, kahoot-ineligible and overridable (the registry flags spec still passes unchanged)
- [ ] Stored audio/youtube questions saved before this change still load with no migration
- [ ] CLAUDE.md's "Question types" description of audio/youtube matches the behaviour
