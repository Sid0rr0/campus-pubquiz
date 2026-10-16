# 02: The break screen rotates the fun facts

**What to build:** `BreakIntroScreen` shows the display view's `funFacts` one at a time, rotating every `FUN_FACT_ROTATE_MS` (8 s) with a gentle transition (respecting `prefers-reduced-motion`). It keeps "BREAK", "Back at…", the bonus list and the feedback prompt. An empty list shows nothing new. The facts are worded for a TV across a room: short, with the team name or question number large.

Parent spec: `.scratch/break-fun-facts/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Rotation under fake timers; a single fact doesn't rotate
- [ ] Each fact kind renders its wording
- [ ] An empty list leaves the break screen as it is today
- [ ] The `/guide` page mentions that the break screen shows fun facts
