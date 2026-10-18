# 03: Pause, play again and fullscreen for video files

**What to build:** The quiz master's media controls work on a video file the same as on a YouTube video.

- `/control` `canPauseMedia` and `canReplayMedia` are true for an open question whose `media_url` is any video (use the shared classifier from 01; `isYoutubeMediaUrl`/`isPausableMediaUrl` are replaced or widened).
- `useMediaPause` takes a video element ref and pauses/plays it like the `<audio>` element; a standing pause is honoured once the element is ready; a rejected `play()` is ignored.
- Play again (`mediaReplayToken` bump) on a video file seeks to the current clip start (0 when none) and plays, clearing pause — no remount. YouTube keeps its remount behaviour.
- Fullscreen toggle enlarges a video file like YouTube, without remounting the element (same tree position inline and fullscreen).
- `/guide` media-buttons paragraph: drop "(YouTube only)" from Play again, mention video files. `/control` keyboard shortcut help text for fullscreen says "image or video". DOCUMENTATION.md pause/replay rows mention video files.

See the spec's "Pause/resume", "Play again" and "Fullscreen" decisions.

**Blocked by:** 01 (02 not required, but play-again's clip start comes from 02's clip if it's done)

**Status:** done

- [x] admin-controls test: `canPauseMedia`/`canReplayMedia` true for `question_open` with an `.mp4`, false for an image.
- [x] `/display` test: toggling `isMediaPaused` calls `pause()`/`play()` on the `<video>`.
- [x] `/display` test: bumping `mediaReplayToken` seeks to the clip start and plays, same element.
- [x] `/display` test: toggling `isFullscreen` keeps the same `<video>` element.
- [x] `pnpm typecheck`, `pnpm lint` and `pnpm --filter frontend test` pass.
