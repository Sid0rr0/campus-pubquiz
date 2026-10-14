# 07: Lobby — teams pop in, rate-limited chime, join confirmation

**What to build:** Spec: `.scratch/player-polish/spec.md`, "Lobby". New teams pop into the big-screen roster with a soft chime, at most one chime per 500 ms however many join. After joining, the phone shows "You're in! Look for <team name> on the big screen". The existing roster marquee and its reduced-motion fallback stay as they are.

**Blocked by:** 01

**Status:** done

- [x] Ten joins within a second play at most two chimes (Vitest, test first)
- [x] Teams present at first snapshot don't pop or chime
- [x] Phone join confirmation names the team

## Comments
