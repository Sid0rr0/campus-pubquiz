# 02: Mute the big screen from /control

**What to build:** A session setting, display sound muted, toggled on `/control` next to the display text scale and carried to the display view the same way. The sound registry from ticket 01 honours it. Spec: `.scratch/player-polish/spec.md`, "Mute". Update `DOCUMENTATION.md` (the setting and its event) and the `/guide` page (the toggle).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Backend: setting the mute is validated, saved, and reaches the display view (Jest, test first)
- [ ] Display: muted → registry plays nothing; unmuted → plays as before (Vitest)
- [ ] `/control` shows the toggle and reflects the current value
- [ ] `DOCUMENTATION.md` and `/guide` updated

## Comments
