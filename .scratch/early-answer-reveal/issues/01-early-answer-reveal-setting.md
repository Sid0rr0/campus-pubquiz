# 01: The Early answer reveal setting

**What to build:** The quiz master can turn **Early answer reveal** on for a pub quiz session (see the [spec](../spec.md)). The start-session dialog and the `/control` lobby settings panel get a "Show correct answers before break" switch, for pub quizzes only. Like the other settings, it can be changed until Start quiz. It has no effect on play yet; tickets 02–05 add that.

- **The setting:** a boolean on the session settings, default off, validated by the partial-settings schema. A stored settings JSON without it reads as off, so no migration is needed.
- **Validation:** a quickfire quiz's session refuses it (400 on session creation and on the settings change), like Versus. Any change after Start quiz is refused, like every setting.
- **Docs:** the session settings section of `DOCUMENTATION.md`. The `/guide` text goes in ticket 07, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The switch shows in the start dialog and the lobby settings panel for a pub quiz, and not for a quickfire quiz
- [ ] Default off; a stored settings JSON without the field reads as off
- [ ] Turning it on for a quickfire session is refused with a 400, both at creation and in the lobby
- [ ] Changing it after Start quiz is refused
- [ ] Session settings tests cover the default, the quickfire refusal and the lobby-only rule
