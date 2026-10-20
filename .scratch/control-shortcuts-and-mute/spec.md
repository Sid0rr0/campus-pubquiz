# Spec: Control shortcuts F / Space / M, and a big-screen mute that silences media

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-10-20 (`/grill-with-docs`). **Big-screen mute** is defined in `GLOSSARY.md`.

## Problem Statement

The quiz master can't reach the media controls they use most from the keyboard on `/control`:

- Space toggles the fullscreen media view, so Pause/Resume, which they need more often and in a hurry, has no key.
- The big-screen mute has no key at all.

The big-screen mute also doesn't do what its name says. It silences only the quiz's own sounds: the round-title sting, the reveal sting, the time-up hit, the fanfare and the lock countdown. A question's YouTube clip, audio file or video file plays out loud while the mute is on. Muting for a speech or an announcement therefore fails exactly when a clip is playing.

## Solution

On `/control`:

- **F** toggles the fullscreen media view (`TOGGLE_MEDIA_FULLSCREEN`), which is Space's current job.
- **Space** pauses or resumes the question's media (`TOGGLE_MEDIA_PAUSE`). It does this only while the Pause/Resume button is shown (an open question with pausable media). Otherwise the key is left to the browser.
- **M** toggles the big-screen mute (`SET_DISPLAY_SOUND_MUTED` with the opposite of the current value), at any point in the session, just as the mute button does.
- Letter keys match either case. This fixes **J**, which today matches only lowercase.
- All shortcuts stay ignored while focus is in a form field. They exist on `/control` only. `/display` gets no keys.
- The Fullscreen, Pause/Resume and Mute buttons get a `title` tooltip naming their key, taken from `ADMIN_SHORTCUTS`.

On `/display`, the big-screen mute also silences every question's media: the YouTube embed (IFrame API `mute`/`unMute`), `<audio>` and `<video>`, both while the question is asked and at reveal, hidden videos included. Media keeps playing while muted, and unmuting brings the sound back at the current position. A mute that is already on applies to media that mounts later (a new question, Play again, a remounted YouTube embed). `/display` shows no muted indicator.

## User Stories

1. As a quiz master, I want Space to pause and resume the clip, so that I can stop it instantly without finding the button.
2. As a quiz master, I want F to blow the question's media up to fullscreen and back, so that the toggle keeps a key.
3. As a quiz master, I want M to mute and unmute the big screen, so that I can silence it for an announcement without reaching for the mouse.
4. As a quiz master, I want the mute to silence a playing YouTube clip, audio file or video file, so that "muted" really means silent.
5. As a quiz master, I want a muted clip to keep playing, so that when I unmute, the room hears it where it has got to, not from the start.
6. As a quiz master, I want a reloaded big screen to come back muted, so that a reconnect never blasts sound in the middle of a speech.
7. As a quiz master, I want Space to do nothing when there's nothing to pause, so that a stray press never sends a meaningless action.
8. As a quiz master, I want F, J and M to work with Caps Lock or Shift held, so that a key press never silently fails.
9. As a quiz master, I want to see a button's key when I hover over it, so that I can learn the shortcuts on the spot.
10. As a moderator typing a grade or a password, I want letter keys and Space to type as normal, so that no shortcut fires by accident.

## Implementation Decisions

- `ADMIN_SHORTCUTS` stays the one definition. `toggleMedia` becomes `toggleMediaFullscreen` (F), and `toggleMediaPause` (Space) and `toggleDisplayMute` (M) are added. `/guide` lists them automatically, and its existing test covers the list.
- `useAdminKeyboardShortcuts` takes `canPauseMedia` (from `admin-controls`) and `isDisplaySoundMuted`, plus a way to set the mute (`setDisplaySoundMuted` from `use-admin-game`). Key matching compares letters case-insensitively.
- Media mute on `/display`: `isDisplaySoundMuted` is passed into `QuestionDisplay` alongside `isMediaPaused`. It is applied in the same place as pause (`use-media-pause`, or a sibling hook beside it), by setting `muted` on `<audio>`/`<video>` and sending `mute`/`unMute` to YouTube, re-applied on YouTube load and on video ready. The quiz preview, when it lands, passes no mute.
- No protocol or backend change: `isDisplaySoundMuted` is already server-owned and in the display view.

## Testing Decisions

- Shortcut hook tests: each key sends its action, Space only when `canPauseMedia`, M sends the opposite of the current mute, uppercase F/J/M work, all keys ignored in form fields, and Space isn't `preventDefault`ed when nothing can pause.
- Media mute tests: muting sets `muted` on audio/video and posts `mute` to the YouTube iframe without pausing; unmuting reverses it; a standing mute applies to newly mounted media and after a YouTube load; pause and mute don't disturb each other.
- Button tests: each tooltip names its key from `ADMIN_SHORTCUTS`.

## Out of Scope

- Shortcuts on `/display` or `/remote`.
- Browser fullscreen of the `/control` window.
- A muted indicator on the big screen.
- Volume control or per-source mutes.

## Further Notes

- Docs: `DOCUMENTATION.md` (the mute paragraph near "Enable sound" and the `isDisplaySoundMuted` row) says the mute now covers media. The `/guide` shortcut list updates itself. The guide's mute wording should match too.
