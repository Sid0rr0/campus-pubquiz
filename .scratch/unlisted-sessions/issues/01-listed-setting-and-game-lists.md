# 01: Listed setting, from switch to game lists

**What to build:** The quiz master can make a session an **Unlisted session** (see the [spec](../spec.md)). The start-session dialog and the lobby settings panel get a "Show in the game list" switch, on by default and editable in the lobby only like every other session setting. An unlisted session no longer appears in the big screen's "Pick a game to display" list or the phone's "Pick the quiz" dropdown. Staff still see it in the staff session list, with an "Unlisted" badge. Joining and reconnecting by code are unchanged.

- **The setting:** `listed: boolean` on the session settings, `true` by default, through the existing creation, partial-settings validation and default fill-in paths. A stored session without the field reads as listed, so there's no migration.
- **The listing:** the session summary carries `listed`. The game state service gets a public listing that returns only listed sessions; `GET /sessions/public` uses it and the staff `GET /sessions` keeps the full listing. The filter runs on the server.
- **Docs:** the session settings section of `DOCUMENTATION.md` and its description of `/sessions/public`. The `/guide` text goes in ticket 03, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] A new session is listed by default, and one created with `listed: false` is not (session creation defaults spec)
- [ ] `listed` can change in the lobby and is refused after Start like the other settings; a stored session without the field reads as listed (update session settings spec)
- [ ] The public listing leaves out unlisted sessions and keeps listed ones; the staff listing keeps both; the summary carries `listed` (the session lifecycle spec's `listSessions` block, real `GameStateService`)
- [ ] `GET /sessions/public` uses the public listing and `GET /sessions` uses the full one (sessions controller spec)
- [ ] The settings form shows "Show in the game list", on by default, and a change reaches the settings it submits (session settings form test)
- [ ] The staff session list shows "Unlisted" on an unlisted session only (session picker panel test)
- [ ] The sessions API contract test covers `listed` on the summary
- [ ] `DOCUMENTATION.md` updated
