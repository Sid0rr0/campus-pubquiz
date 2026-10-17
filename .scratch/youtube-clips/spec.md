# Spec: YouTube clips, reveal clips and hidden videos

Status: ready-for-agent

Blocked by: —

## Problem Statement

A quiz author wants three things from a YouTube question, and gets none of them reliably today:

1. **The clip doesn't reach the editor.** The sample CSV (`apps/frontend/public/sample-quiz-import.csv`) has a YouTube question with notes `{start: "55", end: "88"}`. After import, the editor's clip start/end inputs are empty. The cause: two readers disagree. Save reads the clip with the loose `parseYoutubeClipFromNotes` (so the big screen does play 55–88), but the editor reads with `youtubeClipNotes.read`. That reader only matches a trailing `YouTube clip: {start: "…", end: "…"}` line. Anything looser shows up as free notes. If the author then types a clip, the notes gain a second clip line, and the first `start:` wins at save.
2. **The video can't be hidden.** For a "name this song" question, the author wants the sound without the picture, because the video gives the answer away.
3. **The reveal can't play a different part.** At reveal, the author wants to play another part of the same video, or a separate answer video, each with its own start and end. Today a YouTube `answer_media_url` plays from the beginning, and it plays alongside the question video, so two players can sound at once.

## Solution

A YouTube question carries a **clip**, a **reveal clip** and a **hidden video** flag (see `GLOSSARY.md`), as real question fields that the editor shows and the save writes. The CSV keeps carrying them in the notes cell, read by one lenient parser that the import, the editor and the save all share.

- **Clip:** start/end of the question's video while the question is asked (unchanged behaviour, now autofilled).
- **Reveal clip:** start/end of the video played at reveal. That's `answer_media_url` when set, otherwise the question's own video. One video plays at reveal, never two. Empty reveal start/end means the whole video.
- **Hidden video:** the question's video plays but is covered on the big screen while the question is asked and through break review, and uncovered at reveal. Phones say "🎧 Listen" instead of "👀 Look at the screen".

## User Stories

1. As a quiz author, I want a clip written in my CSV notes to show up in the editor's clip inputs, so that I can see and adjust what was imported.
2. As a quiz author, I want to hide a question's video, so that teams have to name the song from the sound alone.
3. As a quiz author, I want to play a different part of the same video at reveal, so that the reveal can land on the chorus or the title card.
4. As a quiz author, I want a separate answer video with its own start and end, so that the reveal can show something other than the question's video.
5. As someone in the room, I want only one video playing at reveal, so that two soundtracks never play over each other.
6. As a team, I want my phone to tell me to listen when the video is hidden, so that I don't stare at a covered screen.

## Decisions

- **One parser.** A single lenient clip parser in `shared/types/src/youtube.ts` replaces both `parseYoutubeClipFromNotes` and the strict `CLIP_LINE_PATTERN` reader. It reads `start`, `end`, `revealStart`, `revealEnd` (timecodes `SS`, `M:SS`, `H:MM:SS`, quoted or not) and `hideVideo: true` from a `{…}` group anywhere in the notes. It returns the fields plus the notes with that group removed. Notes without a recognised group read as plain free notes, as today.
- **Real fields.** The question (editor draft, `ImportQuestionPreview`, stored payload, question views) carries:
  - the clip as `mediaStartSeconds` / `mediaEndSeconds`, which already exist in the payload
  - `revealStartSeconds` / `revealEndSeconds`
  - `isVideoHidden`

  Notes go back to being free text only.
- **CSV in the notes.** Import pulls the group out of the notes cell into the fields. Export writes the fields back as one canonical group, `{start: "55", end: "1:28", revealStart: "…", revealEnd: "…", hideVideo: true}`, with empty keys left out, appended to the free notes. The CSV header doesn't change. Old CSVs and the old `YouTube clip: {…}` line still import.
- **Existing rows.** Loading a stored question strips any clip group still sitting in its notes, keeping the payload fields as the truth. No DB migration is needed, and re-saving cleans the notes.
- **Which questions.** The clip, the reveal clip and hidden video apply to any question whose media URL is a YouTube link, whatever its type, as the clip does today. The editor shows their inputs only then. The reveal-clip inputs are labelled by which video they apply to ("Answer video clip" when `answer_media_url` is a YouTube link, otherwise "Reveal clip (question video)"). They're shown when either video is YouTube.
- **Reveal plays one video.** When the answer media is a YouTube link, it replaces the question video at reveal, clipped by the reveal clip. Otherwise the question video plays again, clipped by the reveal clip, and if both reveal times are empty it plays whole.
- **Hidden means covered, not removed.** The iframe stays mounted at full size, because a hidden or zero-size player may not autoplay. An opaque panel with a 🎵 label sits over it, in the same tree so it doesn't remount (as the title-bar mask does today). Covered while asked and in break review; uncovered at reveal.
- **Live edits.** These fields follow the existing live-edit rules for media fields. Nothing is special-cased, and grading is untouched.
- **Docs.** `DOCUMENTATION.md`: rewrite the YouTube clip paragraph (around the `youtube` question type and the CSV `notes` column) to cover the notes keys, the reveal clip and hidden video. `/guide`: describe the editor's clip, reveal clip and hidden video inputs. `GLOSSARY.md` already has **Clip**, **Reveal clip** and **Hidden video**.

## Testing Decisions

- Parser: each key, each timecode shape, quoted and unquoted, the legacy `YouTube clip:` line, the sample CSV's `{start: "55", end: "88"}`, no group, and free notes around the group kept intact.
- CSV round trip: import → fields → export → import is stable, and export of a question with no clip adds nothing to the notes.
- Record codec: stored row with old notes clip line loads with fields set and the notes stripped.
- Editor: importing the sample CSV fills the clip inputs with 55 and 88 (the regression for problem 1).
- Display: a hidden video is covered in question view and break review and uncovered at reveal. At reveal with a YouTube answer media, only the answer iframe exists and its src carries the reveal clip. Without answer media, the question iframe's src carries the reveal clip, or no clip when empty.
- Phones: "🎧 Listen" for a hidden video, "👀 Look at the screen" otherwise.

## Out of Scope

- Hiding non-YouTube media (images, audio files).
- Clips for audio-file media.
- New CSV columns.
- Showing both videos side by side at reveal.
