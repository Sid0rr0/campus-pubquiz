# 02: Remove the audio and YouTube question types

**What to build:** Remove `audio` and `youtube` from `QUESTION_TYPES` and the Question kind registry, together with their preview schemas, payload schemas and moderator notes. From then on, media is only something a question carries.

- **CSV import.** A row typed `audio` or `youtube` (after normalisation) gets its own `type` issue instead of "Unknown question type": `Question type "audio" was removed — use free_text (or multiple_choice if the row has options) and keep the media_url.`
- **Sample CSV.** `apps/frontend/public/sample-quiz-import.csv` is rewritten so that its media rows are `free_text`/`multiple_choice` rows that keep their audio file, YouTube clip, reveal clip and hidden video.
- **Fixtures and tests.** Every fixture and test that used the two types moves to `free_text` (or `multiple_choice` where it had choices), including the hard-coded backend fixture and the e2e `quiz-night.csv`. Tests that existed only for audio requiring media or for the youtube URL check are deleted.
- **Docs**, in the same commit: DOCUMENTATION.md, the `/guide` page, README.md and CLAUDE.md, as listed in the spec's "Docs" decision.

The optional-choices machinery stays in place for now (it simply has no users), and 03 removes it. See the spec's Implementation Decisions.

**Blocked by:** 01

**Status:** done

- [ ] `QUESTION_TYPES` is exactly `multiple_choice`, `free_text`, `sort`, `match`, `closest_guess`, `number`, and the registry, preview and payload schemas have no audio/youtube entries.
- [ ] `parseQuestionRow` gives the removed-type message on the `type` field for `audio`, `Audio`, `youtube` and ` YouTube `. Any other unknown type still gets the generic message.
- [ ] A `free_text` row with an mp3 `media_url` imports. A `multiple_choice` row with a YouTube `media_url` and `{start, end, revealStart, revealEnd, hideVideo}` notes imports with its clip, reveal clip and hidden video (`parse-media-question-types.spec.ts` becomes the media-on-any-type spec).
- [ ] The sample CSV imports with no issues and still contains an audio question, a clipped YouTube question, a reveal clip and a hidden video. `sample-quiz-import.spec.ts` finds the YouTube questions by media URL instead of by type.
- [ ] The CSV export → import round trip still covers YouTube clip notes on a non-media type.
- [ ] Pasting a YouTube URL into a free text or multiple choice question in the editor shows the clip inputs.
- [ ] The e2e happy path still sees the big screen's `<audio>` player, now from a `free_text` question.
- [ ] No remaining `'audio'`/`'youtube'` question-type literals in `shared/types/src`, `apps/*/src`, `apps/frontend/app` or `e2e/`, except for the migration from 01 and the removed-type import message and its test.
- [ ] The docs listed in the spec are updated, and the `/guide` page says once that any question can carry media.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and `pnpm e2e` passes locally.
