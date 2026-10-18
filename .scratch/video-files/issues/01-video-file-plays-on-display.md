# 01: A video file link plays on the big screen

**What to build:** The shared media classifier, and `/display` rendering of a video file as question media and as answer media, with the "video" reveal rule. After this ticket an `.mp4` link plays (whole video, no clip yet) instead of showing a broken image.

- New shared module (e.g. `shared/types/src/media.ts`) classifying an http(s) link as image / audio / YouTube video / video file, with `isVideoUrl` (YouTube or file). The audio pattern moves here from `question-display.tsx`; the display and `isPausableMediaUrl` use it.
- Video file extensions: `.mp4`, `.webm`, `.mov`, `.m4v`, case-insensitive, query string allowed.
- `QuestionDisplay` and `AnswerMedia` render a `<video>` for a file link: `playsInline`, no `controls`, `autoPlay` from `autoplayMedia`, 16:9 inline box like the YouTube one. Closest-guess reveal gets it through `AnswerMedia`.
- Reveal rule over "video": a video `answer_media_url` (either source) replaces the question media at reveal; otherwise a question video plays again. Mixed YouTube/file combinations work. Side-by-side image reveal unchanged.
- On the `<video>` `error` event the video area is hidden; prompt and answers stay.
- DOCUMENTATION.md "Media on any question": video file links, the extensions, the reveal rule worded over video, the failure behaviour, and a note to link short compressed clips. `/guide` media paragraph mentions video file links.

See the spec's "Recognising a video file", "One media classifier", "Rendering on /display", "Reveal rule" and "Load failure" decisions.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Shared classifier table test: each extension, uppercase, `?query`, YouTube, audio, image, non-http.
- [x] `/display` test: an `.mp4` `media_url` renders a `<video>` without controls, not an `<img>`.
- [x] `/display` test: a video file `answer_media_url` replaces question media at reveal (file→file, YouTube question + file answer, file question + YouTube answer).
- [x] `/display` test: an image question with an `.mp4` answer keeps the side-by-side layout rule as today (question image shown only for image questions).
- [x] `/display` test: a `<video>` `error` event removes the video, prompt still shown.
- [x] `pnpm typecheck`, `pnpm lint` and `pnpm --filter frontend test` / shared-types tests pass.
