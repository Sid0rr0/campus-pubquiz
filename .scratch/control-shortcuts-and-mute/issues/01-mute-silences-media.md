# 01: Big-screen mute silences question media

Status: done

Spec: [Control shortcuts and mute](../spec.md)

**What to build:** While the big-screen mute is on, `/display` plays every question's media without sound: YouTube (IFrame API `mute`/`unMute`), `<audio>` and `<video>`, both while the question is asked and at reveal. The media keeps playing, and unmuting brings the sound back where the clip has got to. A standing mute applies to media that mounts later (a new question, Play again, a YouTube embed that finishes loading). `isDisplaySoundMuted` is passed into `QuestionDisplay` and applied next to the media pause.

**Blocked by:** None (can start immediately).

- [ ] Muting sets `muted` on audio/video and posts `mute` to the YouTube iframe, without pausing. Unmuting reverses it.
- [ ] A standing mute applies to newly mounted audio/video and is re-sent after a YouTube load.
- [ ] Pause and mute don't disturb each other, in either order.
- [ ] Reveal media (a video-file answer) is muted as well.
- [ ] `DOCUMENTATION.md` mute wording (the "Enable sound" paragraph and the `isDisplaySoundMuted` row) and the `/guide` mute text say it covers media.
