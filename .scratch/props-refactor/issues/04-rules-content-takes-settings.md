# 04: Rules content and the phone's game status screens take the session settings object

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The rules content takes the session settings as one object instead of four fields spread apart identically at three call sites (big screen, phone, standalone rules page). The phone's game status screens take the same object and hand it on, instead of receiving the four fields only to forward them. The prop is typed by picking the four fields used (house rules, enabled bonus categories, max players per team, extra player penalty points) from the shared session settings type.

Teams and the audience see the same rules screen as today, on every screen that shows it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Rules content takes one settings prop typed from the shared session settings type
- [ ] The phone's game status screens take the same settings object and pass it through
- [ ] The display, /play and the standalone rules page pass the settings object they already hold
- [ ] Existing /display rules tests, /play pre-game screens tests and rules page behaviour pass unchanged
