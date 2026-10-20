# 02: F / Space / M shortcuts on /control

Status: done

Spec: [Control shortcuts and mute](../spec.md)

**What to build:** In `ADMIN_SHORTCUTS`, `toggleMedia` becomes `toggleMediaFullscreen` on **F**. Add `toggleMediaPause` on **Space** (`TOGGLE_MEDIA_PAUSE`, only when `canPauseMedia`; otherwise the key is not handled) and `toggleDisplayMute` on **M** (sets the mute to the opposite of `isDisplaySoundMuted`, at any time). Letter keys match either case, which fixes J. The Fullscreen, Pause/Resume and Mute buttons get a `title` naming their key from `ADMIN_SHORTCUTS`.

**Blocked by:** None. It can land before 01, but M only silences media once 01 is in.

- [ ] F sends `TOGGLE_MEDIA_FULLSCREEN`, and Space no longer does.
- [ ] Space sends `TOGGLE_MEDIA_PAUSE` only when `canPauseMedia`. Otherwise it is not `preventDefault`ed and sends nothing.
- [ ] M sets the mute to the opposite of the current value.
- [ ] Shift/Caps Lock F, J and M work. All keys are still ignored in form fields.
- [ ] The tooltips on the three buttons name their keys. The `/guide` shortcut list test stays green with the new entries.
