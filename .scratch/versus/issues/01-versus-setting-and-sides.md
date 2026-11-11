# 01: Versus setting and sides on /control

**What to build:** The quiz master can turn **Versus** on for a pub quiz session and name its **Sides** (see the [spec](../spec.md)). The start-session dialog and the lobby settings panel get a Versus switch and a list of 2–4 side names. Like the other session settings, they can be edited until Start quiz.

- **The setting:** a Versus switch and a list of sides on the session settings. Each side has a stable id and a name. Defaults: Versus off, no sides. A stored session without the fields reads as Versus off, so the settings need no migration.
- **Validation:** while Versus is on, there must be 2–4 sides, and names are trimmed, non-blank and unique ignoring case. The session refuses Versus for a quickfire quiz's session, with a clear message in the style of the jokers-need-overview refusal, and refuses any Versus change after Start quiz, like other settings.
- **Colour:** not stored. A side's position in the list maps onto a fixed four-colour palette. Add the palette now and show each side's colour swatch in the settings form.
- **Docs:** the session settings section of `DOCUMENTATION.md`. The `/guide` text goes in ticket 07, not here.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A new session has Versus off and no sides; a stored session without the fields reads the same
- [ ] Versus on with fewer than 2 or more than 4 sides, a blank name, or names that differ only by case is refused (session settings schema spec)
- [ ] Versus is refused for a quickfire quiz's session, and any Versus change is refused after Start quiz (gateway settings spec, following `jokers-setting.spec`)
- [ ] Renaming a side keeps its id
- [ ] The settings form shows the switch, the side names with colour swatches, add and remove buttons (capped at 4), and submits the list (settings form test)
- [ ] The Versus switch isn't offered for a quickfire quiz
- [ ] `DOCUMENTATION.md` updated
