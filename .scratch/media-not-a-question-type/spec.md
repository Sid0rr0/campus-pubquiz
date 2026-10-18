# Spec: Media is something any question carries, not a question type

Status: ready-for-agent

## Problem Statement

The question type registry has two media types, `audio` and `youtube`. Apart from their media, both behave exactly like `free_text`, which is why they carry their own schema, payload codec, CSV codec, `/guide` note and test matrix rows. But media no longer depends on the type: every question type can carry a `media_url` and an `answer_media_url`. The big screen works out from the URL whether it's an image, audio or a YouTube video. Clips, reveal clips, the hidden video and pause/replay all key off "is this a YouTube URL", not off the type. DOCUMENTATION.md already says there is "deliberately no dedicated `picture` type" for this reason.

Compared with `free_text`, the two types add only four things:

1. The editor makes media required.
2. Choices are optional (`choices: 'optional'`).
3. `youtube` rejects a URL that isn't a YouTube link, and shows the clip inputs before a URL has been typed.
4. Their CSV codec allows options.

The optional choices produce an odd hybrid. Teams pick a choice, but grading stays `match-or-human`: a wrong pick isn't marked incorrect, it waits for the quiz master. These questions are also kept out of kahoot rounds. A `multiple_choice` question with the same audio file is graded automatically and is allowed in kahoot rounds. Nobody relies on the hybrid. It's friction, and it's a second way to write the same question.

## Solution

Remove the `audio` and `youtube` question types. Media becomes purely something any question carries, as pictures already are.

- A migration re-types every stored `audio`/`youtube` question. One with no choices becomes `free_text`, with the same grading. One with choices becomes `multiple_choice`, so it's now graded automatically and allowed in kahoot rounds.
- A CSV row whose type is `audio` or `youtube` is rejected with a message naming the replacement.
- The "optional choices" machinery, which only these two types used, is deleted, so a question's answer kind comes from its type alone.

## User Stories

1. As a quiz author, I want to put an audio file or YouTube video on any question type, so that I can write a music multiple choice, a "how many seconds is this clip" number question, or a "sort these songs" question without a special type.
2. As a quiz author, I want the type picker to list only types that differ in how teams answer and how answers are graded, so that I don't have to choose between "Free text" and "Audio" when they behave the same.
3. As a quiz author, I want my existing audio and YouTube questions to keep working after the upgrade without my touching them, so that no saved quiz breaks.
4. As a quiz author, I want an existing audio/YouTube question that had choices to become a multiple choice question, so that it keeps its choices and is now graded automatically.
5. As a quiz author, I want an old CSV with `audio` or `youtube` in the type cell to be rejected with a message telling me what to write instead, so that I fix the row instead of guessing.
6. As a quiz author, I want the sample import CSV to show media on ordinary question types (audio on free text, YouTube with clips on free text and multiple choice), so that I learn the new way from the example.
7. As a quiz author, I want the clip inputs to appear as soon as I paste a YouTube link into any question, so that I can still clip a video without a YouTube type.
8. As a quiz master, I want a wrong pick on a music multiple choice question to be marked incorrect automatically, so that I don't have to grade picks during the break.
9. As a quiz master, I want the `/guide` page to say that any question can carry media, so that I know how to make a music round.
10. As an audience member, I want audio and YouTube questions to play on the big screen exactly as before, so that nothing changes on quiz night.

## Implementation Decisions

- **Question types.** `audio` and `youtube` are removed from `QUESTION_TYPES` and from the Question kind registry, together with their preview schemas, payload schemas and moderator notes. Media rendering on `/display`, `/play` and `/control` already works from the URL and doesn't change.
- **Data migration** (a new MikroORM migration, following `Migration20261001120000_RetypePictureQuestions`). Every `questions` row whose type is `audio` or `youtube` is re-typed:
  - `multiple_choice` when `payload.options` is a JSON array with at least one non-blank entry. This is the same test `resolveAnswerKind` uses today to decide the `choice` answer kind. The audio/youtube preview schema already required the answer to be one of the options, with at least two distinct non-empty options, so these rows already pass the `multiple_choice` rules.
  - `free_text` otherwise, with any `options` key removed from the payload. The payload codec would drop the key on read anyway, but the stored row should match its type.
  - Every row is migrated, including questions from ended sessions. Their existing grades are stored on the answers and stay as they are; only the type label that session stats show changes. `down()` is a no-op, because the original rows can't be told apart afterwards, as with the picture migration.
- **CSV import.** A row with type `audio` or `youtube` (after the usual normalisation) gets its own `type` issue instead of the generic "Unknown question type" message: `Question type "audio" was removed — use free_text (or multiple_choice if the row has options) and keep the media_url.` There are no silent aliases.
- **No YouTube URL check.** The `youtube` type's "must be a YouTube link" refinement is not replaced. The http(s) check on `mediaUrl` stays. The editor already shows the clip inputs only once a URL is recognised as YouTube, which is enough of a signal.
- **The optional-choices machinery goes** (YAGNI), because no type uses it any more:
  - `'optional'` is removed from `QuestionKind['choices']`, which becomes `'none' | 'required'`.
  - `withOptionalChoiceRules` and `optionalChoices` are removed from the preview schemas.
  - `resolveAnswerKind`'s optional branch is removed, so a question's answer kind is `choice` for a required-choices type and otherwise the type's input kind.
  - The editor's `hasOptionalChoices` path is removed: `TypedAnswerFields` no longer renders a choice list, and the related prop on `ChoiceFields`/`ChoiceList` goes.
  - `requiresMedia` stays on the registry entry, even though every type is now `false`, only if something other than the editor still reads it. Otherwise it is removed too, together with `hasYoutubeMedia` on the registry entry, and the editor marks the media URL field optional for every type.
- **Fixtures and test data.** Tests that used `audio`/`youtube` only as "a typed-answer, match-or-human type" switch to `free_text` (with a media URL where the test is about media). Tests that exist only to cover the removed behaviour are deleted: optional choices, audio requiring media, the youtube URL check, and audio/youtube parity rows. The hard-coded backend fixture and the e2e `quiz-night.csv` fixture become `free_text` with the same media URL.
- **Sample import CSV** (`apps/frontend/public/sample-quiz-import.csv`). Rewrite its audio/youtube rows as `free_text` or `multiple_choice` rows that keep their media, clips, reveal clip and hidden video, so the sample shows media on ordinary types. `sample-quiz-import.spec.ts` updates its expected type list and finds the YouTube questions by media URL instead of by type.
- **Docs, in the same commit as the code:**
  - DOCUMENTATION.md: the question types list, the "no dedicated `picture` type" sentence (now "no picture, audio or YouTube type"), the grading and answer-kind sections (no optional choices; `match-or-human` is `free_text` only), and the CSV section (media URL required for no type, plus the removed-type message).
  - The `/guide` page: drop the two moderator notes, say once that any question can carry media, and change "Typed answers (free text, audio, YouTube)" to free text.
  - README.md's question-type list, if it names them.
  - CLAUDE.md's "live answer-key fixes overwrite manual overrides" tradeoff: typed-answer types become `free_text` only.
  - GLOSSARY.md is already updated (Question type, Media, Hidden video, Answer kind, Grading).
- **No ADR.** Re-adding a type is cheap, so the decision isn't hard to reverse, and DOCUMENTATION.md's one sentence records the why.

## Testing Decisions

- **What makes a good test:** it drives a public interface (the registry and its schemas, the CSV import, the answer-kind resolver, the editor panel, the migration against a real database) and asserts on what a caller sees, not on internal helpers.
- **Seam 1: the migration, against Postgres.** Prior art: `apps/backend/src/db/__tests__/answer-verdict-backfill.spec.ts` (`useUnmigratedTestDatabase`, migrate up to the previous migration, insert raw rows, migrate up, assert). Cases:
  - audio without options → `free_text`;
  - youtube with `options: []` → `free_text`, with the options key removed;
  - audio with options `["Queen","Abba"]` → `multiple_choice`, with the options kept;
  - youtube with all-blank options → `free_text`;
  - a `number` row → untouched;
  - payload media and clip fields are preserved;
  - answers on a migrated question keep their points and verdict.
- **Seam 2: CSV import (backend `parseQuestionRow`).** `audio`, `Audio`, `youtube` and ` YouTube ` each give the removed-type message on the `type` field. A `free_text` row with an mp3 `media_url` imports. A `multiple_choice` row with a YouTube `media_url` and clip notes imports with its clip. Prior art: `parse-media-question-types.spec.ts`, which becomes the media-on-any-type spec.
- **Seam 3: shared types.** `QUESTION_TYPES` is exactly the six remaining types. `resolveAnswerKind` takes the type's input kind regardless of `options` on a non-choice type. The CSV round trip still covers YouTube clip/reveal/hidden notes on a `free_text` question. Prior art: `answer-kind.test.ts`, `question-csv-round-trip.test.ts`, `question-kind-parity.test.ts`.
- **Seam 4: quiz editor panel.** A free text question shows no choice list. Pasting a YouTube URL into a free text or multiple choice question shows the clip inputs. Prior art: `quiz-editor-panel.test.tsx`.
- **E2E.** The happy path still asserts the big screen's audio player, now driven by a `free_text` question with an mp3 `media_url`.

## Out of Scope

- New media kinds (uploaded video files, Reddit/Vercel Blob video). Those are a separate question about the URL-to-player inference, not about types.
- A per-question "media required" flag. Nobody needs it.
- Re-adding the "choices, but hand-graded" behaviour in some other form.
- Any change to how media renders, autoplays, pauses or replays.

## Further Notes

- Sessions hold a seeded copy of the quiz in memory and reload it from the database on boot, and the migration runs before that. A session that is live during the deploy reloads with the new types. An answer to a former audio-with-choices question that was waiting for the quiz master stays ungraded and is graded by hand as before. Newer answers to that question are graded automatically.
- The glossary term **Media** was added for this spec. Use "a question with audio media", not "an audio question".
