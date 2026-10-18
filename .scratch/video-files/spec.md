# Spec: Video files as media

Status: ready-for-agent

## Problem Statement

Media on a question can be an image, sound or YouTube video, and which one it is follows from the link. A link to a video file (an `.mp4` on a CDN, a university server, a public bucket) isn't recognised: anything that isn't YouTube or an audio extension is drawn as an `<img>`, so a `.mp4` `media_url` or `answer_media_url` shows a broken image on the big screen. Quiz authors who have a clip as a file have to upload it to YouTube first, which isn't always possible (copyright blocks, private clips, no account).

## Solution

A link to a video file becomes a third kind of video-capable media alongside YouTube. **Video** in the glossary now means either a YouTube link or a link to a video file (already updated). A video file gets everything a YouTube video has — clip, reveal clip, hidden video, pause/resume, play again, fullscreen — and follows the same reveal rule: exactly one video plays at reveal.

Video is link-only. The editor's upload button stays images-only.

## User Stories

1. As a quiz author, I want to paste an `.mp4`/`.webm`/`.mov`/`.m4v` link into a question's media URL and have it play on the big screen, so that I don't need to put the clip on YouTube.
2. As a quiz author, I want to use a video file as answer media, so that the reveal can show the clip the answer came from.
3. As a quiz author, I want the clip start/end and reveal clip inputs to appear for a video file link exactly as for a YouTube link, so that I can play only the part I need.
4. As a quiz author, I want the "Hide video (sound only)" checkbox for a video file, so that I can run a "name the film from the soundtrack" question and show the picture at reveal.
5. As a quiz author, I want the CSV notes group (`start`, `end`, `revealStart`, `revealEnd`, `hideVideo`) to apply to video file links, so that import and export round-trip the same as YouTube.
6. As a quiz master, I want Pause/Resume, Play again and the fullscreen toggle to work on a video file, so that I run the room the same way whatever the source.
7. As a quiz master, I want a video file to play without browser controls on the big screen, so that the audience sees a clean picture and I drive it from `/control`.
8. As an audience member, I want a dead video link to leave a clean screen (prompt and answers, no broken player), so that a bad link doesn't look like the app crashed.
9. As a quiz master, I want the `/guide` page to say that video file links work like YouTube links, so that I know I can use them.

## Implementation Decisions

- **Recognising a video file.** By extension, the same way audio is: `.mp4`, `.webm`, `.mov`, `.m4v` (case-insensitive, query string allowed). Video hosting pages (Vimeo, Google Drive, Dropbox share links) are out of scope; they are not direct files.
- **One media classifier in shared types.** Today the audio pattern lives in `apps/frontend/app/display/question-display.tsx` and the YouTube check in `shared/types/src/youtube.ts`. Move the link inference into one shared module (e.g. `shared/types/src/media.ts`) that classifies an http(s) link as image, audio, YouTube video or video file, plus an `isVideoUrl` (YouTube or video file) predicate. Every place that currently asks "is this YouTube?" in order to decide whether clip/reveal/hidden/replay/fullscreen apply asks "is this a video?" instead:
  - `question-record-codec.ts` (`previewToStoredFields`: clip fields reach the payload),
  - `question-row-schema.ts` (CSV decode `clipPreviewFieldsOf`, encode `clipNotesFieldsOf`, `hasYoutubeMedia` → a video equivalent),
  - the quiz question editor's clip/reveal/hidden inputs,
  - `/control`'s `canReplayMedia` and `canPauseMedia`.
  YouTube-specific helpers (`extractYoutubeVideoId`, embed src building) stay YouTube-specific.
- **Rendering on `/display`.** A `<video>` element with `playsInline`, no `controls`, `autoPlay` from the existing `autoplayMedia` setting, `preload` default. Sound relies on the existing "Enable sound" button for autoplay policy. Layout follows the YouTube one (16:9 box inline, the same fullscreen overlay), and the element must keep the same tree position across fullscreen toggles so it doesn't remount.
- **Clips.** Applied with a media fragment on the src (`#t=start,end`, either end optional) — the browser starts at `start` and pauses at `end`. While asked the question clip applies; at reveal the reveal clip; empty means the whole video. Same semantics as YouTube.
- **Reveal rule.** Phrase it over "video", not "YouTube": a video `answer_media_url` (either source) replaces the question's media at reveal, clipped by the reveal clip; otherwise the question's video plays again with the reveal clip (a hidden video just lifts its cover, no restart). Mixed sources (YouTube question, file answer and vice versa) work. The side-by-side image reveal is unchanged (it only applies to an image question).
- **Hidden video.** The same 🎵 cover over a full-size playing `<video>`; lifted at reveal without remounting. Phones say "🎧 Listen" as for YouTube.
- **Pause/resume.** `useMediaPause` gains a video element ref and pauses/plays it like the `<audio>` element (a rejected `play()` is ignored, as now).
- **Play again.** Seeks the `<video>` back to the current clip start (0 when none) and plays, clearing pause — no remount, no re-download. YouTube keeps its remount behaviour.
- **Fullscreen.** The spacebar toggle enlarges a video file like a YouTube video.
- **Load failure.** If the `<video>` fires `error`, the display hides the video area for that media (prompt and answer body stay). No retry, no message on the big screen. Images and audio are unchanged.
- **Loading.** Load only when the question opens; no prefetching of upcoming questions' videos.
- **No upload.** `POST /media` stays images-only, 5 MB cap.
- **No new fields or migration.** Clip, reveal clip and `isVideoHidden` are existing fields; only the condition that gates them widens. Existing quizzes are untouched.
- **Docs, in the same commit as the code that changes them:** DOCUMENTATION.md ("Media on any question", the pause/replay/fullscreen rows, the CSV notes paragraph, a note that video files should be short, compressed clips because venue internet carries them), the `/guide` page (media, hidden video, clip and media-button paragraphs), the `/control` keyboard shortcut text for fullscreen. GLOSSARY.md is already updated (Media, Clip, Reveal clip, Hidden video).
- **No ADR.** Easy to reverse; the decision is a widening of an existing rule.

## Testing Decisions

- **What makes a good test:** it drives a public interface (the shared classifier, the CSV/record codecs, the rendered display, the editor panel, `/control`'s derived controls) and asserts what a caller sees.
- **Seam 1: shared types.** Classifier table test (each extension, uppercase, query string, YouTube links, audio links, images, non-http). CSV round trip: a `free_text` row with an `.mp4` `media_url` and `{start, end, revealStart, revealEnd, hideVideo}` notes decodes to the clip fields and encodes back; a row with an `.mp4` `answer_media_url` and an image `media_url` keeps only the reveal clip. Record codec keeps clip fields for an `.mp4`. Prior art: `youtube.test.ts`, `question-csv-round-trip.test.ts`, `question-record-codec.test.ts`.
- **Seam 2: `/display` rendering.** A question with an `.mp4` renders a `<video>` (not an `<img>`) without controls and with the clip fragment; reveal swaps to the reveal clip; a video `answer_media_url` replaces the question media (both file→file and YouTube↔file); hidden video cover shows while asked and lifts at reveal without remounting; an `error` event hides the video; pause/play are called on the element. Prior art: `media-rendering.test.tsx`, `hidden-video.test.tsx`, `question-display.test.tsx`.
- **Seam 3: `/control`.** `canReplayMedia`/`canPauseMedia` are true for an open question with an `.mp4`. Prior art: the admin-controls tests.
- **Seam 4: editor panel.** Pasting an `.mp4` shows the clip inputs and the hidden-video checkbox; an `.mp4` answer media labels the reveal pair "Answer video clip". Prior art: `quiz-editor-panel.test.tsx`.

## Out of Scope

- Vimeo, Google Drive, Dropbox and other hosting-page embeds.
- Uploading video files.
- A media preview in the editor (useful for every media kind; its own ticket).
- Prefetching the next question's video.
- Changing how image or audio failures look.
