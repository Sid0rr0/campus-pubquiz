# 02: "Have a game code?" on the join form

**What to build:** A team can join any session by typing its join code. The join form on `/play` and the home page gets a "Have a game code?" toggle that opens the typed "Game code" field, closed by default; the "Pick the quiz" dropdown stays as it is. A team arriving with a `?code=` (from the QR code) that isn't in the game list (an **Unlisted session**, see the [spec](../spec.md)) finds the field already open with that code in it, so they can see which game they're joining. The field and the dropdown share the form's code, so Join sends whichever the team used last. A mistyped code is refused with the usual message.

- This ticket doesn't need ticket 01: any prefilled code missing from the list opens the field.
- **Docs:** the join-form description in `DOCUMENTATION.md`. The `/guide` text goes in ticket 03, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The "Game code" field is hidden until the team taps "Have a game code?" (join form test)
- [ ] A typed code is what Join sends, and picking from the dropdown afterwards replaces it (join form test)
- [ ] A prefilled code missing from the game list opens the field with the code in it; a prefilled code in the list leaves it closed with the dropdown showing that game (join form / live session select tests)
- [ ] Works the same on `/play` and the home page
- [ ] `DOCUMENTATION.md` updated
