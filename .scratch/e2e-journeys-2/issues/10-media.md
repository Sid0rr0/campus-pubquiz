# 10: Media

**What to build:** A journey on a small CSV with an image, an audio file, a video file, a YouTube clip, a hidden video and a video `answer_media_url`. Asserts the right player and `src` on `/display` (clip fragment or embed params included), the hidden-video cover lifted at reveal, the reveal clip, and the pause, replay and fullscreen controls changing the display. Uses the interception from 01; no network.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each media kind renders with the intercepted fixture or stub.
- [ ] Pause, replay and fullscreen moves are recorded.
- [ ] Phones show "🎧 Listen" for a hidden video.
- [ ] Passes `--repeat-each=5`.
