# 04: Rules content and the phone's game status screens take the session settings object

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The rules content takes the session settings as one object instead of four fields spread apart identically at three call sites (big screen, phone, standalone rules page). The phone's game status screens take the same object and hand it on, instead of receiving the four fields only to forward them. The prop is typed by picking the four fields used (house rules, enabled bonus categories, max players per team, extra player penalty points) from the shared session settings type.

Teams and the audience see the same rules screen as today, on every screen that shows it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Rules content takes one settings prop typed from the shared session settings type
- [x] The phone's game status screens take the same settings object and pass it through
- [x] The display, /play and the standalone rules page pass the settings object they already hold
- [x] Existing /display rules tests, /play pre-game screens tests and rules page behaviour pass unchanged

## Comments

Implemented in the commit titled `refactor(frontend): rules content and phone status screens take the session settings object` (hash in git history). `RulesContent` takes `settings?: RulesSettings` (a `Pick` of the four fields from `SessionSettings`); when omitted (standalone /rules without a session) it uses default house rules and team size with no bonus bullets, as before. `rules-content.test.tsx` was updated to the new prop shape and gained a team-size/penalty test. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
