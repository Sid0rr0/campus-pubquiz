# 03: Guide: unlisted sessions

**What to build:** The in-app `/guide` page tells the moderator about **Unlisted sessions** (see the [spec](../spec.md)): what the "Show in the game list" switch does and that it can only change in the lobby, that the session still appears in their own session list marked "Unlisted", how to put it on the big screen (the display link on `/control`), and how teams join it (scan the QR code, or "Have a game code?" and type the code from the big screen). Keep within the guide's word cap.

**Blocked by:** 01 (Listed setting, from switch to game lists), 02 ("Have a game code?" on the join form)

**Status:** done

- [ ] `/guide` describes the switch, the badge, opening the big screen and the two ways teams join, in the words the UI uses
- [ ] The guide's tests (including its word cap) pass
- [ ] `pnpm e2e` passes, confirming the journeys still join through `/play?code=` with the reworked join form
