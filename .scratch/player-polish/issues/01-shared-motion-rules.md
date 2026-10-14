# 01: Shared motion, sound and vibration rules

**What to build:** The foundation every other ticket in this feature uses (spec: `.scratch/player-polish/spec.md`, "Shared rules"). A frontend helper that decides whether a one-off effect may fire: only on a live forward move seen by a connected client, never on the first snapshot after load or reconnect, never on Previous. A display sound registry that names every display sound, plays through the existing sound unlock and stays silent when muted (the mute input is wired here; ticket 02 supplies the setting). A phone vibration helper wrapping `navigator.vibrate` that does nothing where unsupported. Add `canvas-confetti`. Add the CC0 sound files under `apps/frontend/public/sounds/` with a licence note. Write the motion rules into `CODING_STANDARDS.md`: reduced motion means crossfade only, only `transform`/`opacity` animate, animation never gates a press, one-off effects go through the live-change helper.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Live-change helper: first snapshot after connect → no effect (test first)
- [ ] Live-change helper: forward move into a moment → effect fires once
- [ ] Live-change helper: a Previous move → no effect
- [ ] Sound registry plays nothing while muted or before sound is unlocked
- [ ] Vibration helper is a no-op when `navigator.vibrate` is missing
- [ ] Sound files and licence note committed; `canvas-confetti` added
- [ ] `CODING_STANDARDS.md` carries the motion rules

## Comments
