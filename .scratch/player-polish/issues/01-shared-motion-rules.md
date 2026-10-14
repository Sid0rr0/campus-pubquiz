# 01: Shared motion, sound and vibration rules

**What to build:** The foundation every other ticket in this feature uses (spec: `.scratch/player-polish/spec.md`, "Shared rules"). A frontend helper that decides whether a one-off effect may fire: only on a live forward move seen by a connected client, never on the first snapshot after load or reconnect, never on Previous. A display sound registry that names every display sound, plays through the existing sound unlock and stays silent when muted (the mute input is wired here; ticket 02 supplies the setting). A phone vibration helper wrapping `navigator.vibrate` that does nothing where unsupported. Add `canvas-confetti`. Add the CC0 sound files under `apps/frontend/public/sounds/` with a licence note. Write the motion rules into `CODING_STANDARDS.md`: reduced motion means crossfade only, only `transform`/`opacity` animate, animation never gates a press, one-off effects go through the live-change helper.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Live-change helper: first snapshot after connect → no effect (test first)
- [x] Live-change helper: forward move into a moment → effect fires once
- [x] Live-change helper: a Previous move → no effect
- [x] Sound registry plays nothing while muted or before sound is unlocked
- [x] Vibration helper is a no-op when `navigator.vibrate` is missing
- [x] Sound files and licence note committed; `canvas-confetti` added
- [x] `CODING_STANDARDS.md` carries the motion rules

## Comments

- The agent environment could only write text files, so the CC0 audio files could not be added. `apps/frontend/public/sounds/LICENSE.md` lists the expected file names and marks each as TODO for a human to drop in with its source. Missing files fail silently.
- The helper takes a caller-supplied monotonic `position` number; the wire carries no move direction. Later tickets choose the position (e.g. a step ordinal).
