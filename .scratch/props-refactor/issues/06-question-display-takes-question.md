# 06: The question display takes a question object

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The question display takes one question prop instead of up to nine fields of a question spread apart at each of its four call sites (the display page, the question open screen, the break review screen and the phone's question browser). The prop is typed by picking the fields rendered from the shared question view type, with the reveal-only fields (answer, answer media) optional. The display's presentation props (test-id prefix, autoplay, prompt class, fullscreen, media replay token, the team's own answer) stay separate.

The phone's question browser deliberately shows no media. It says so explicitly (a flag, or a question object without media) rather than by leaving fields out. The current renaming of the answer to "correct answer" is dropped in favour of the shared type's name.

The audience and teams see questions, options, media and revealed answers exactly as today. Phones still show no media.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The question display takes one question prop typed from the shared question view type
- [ ] All four call sites pass the question they already hold
- [ ] The phone's question browser opts out of media explicitly, and phones still render no media
- [ ] Existing /display tests (question display, media rendering, break, reveal) and /play question tests pass unchanged in behaviour
