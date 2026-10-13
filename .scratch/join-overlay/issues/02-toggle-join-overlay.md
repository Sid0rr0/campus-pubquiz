# 02: Toggle join overlay

**What to build:** Once the quiz has started, a quiz master (admin or moderator) can press Toggle join overlay on `/control` to cover the big screen with the **join overlay**: the QR code, join code and team-size/penalty line from the lobby, without the roster. A late team can scan it and join. Pressing the button again hides the overlay, and the big screen is back exactly where the quiz is. The quiz doesn't move underneath: timers keep running and phones are untouched. The button can't be used in the lobby (which already shows the QR code) or once the quiz has ended. End quiz clears the overlay. The overlay is saved, so it's still up after a backend restart. See `.scratch/join-overlay/spec.md` and **Join overlay** in `GLOSSARY.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Session progress has an `isJoinOverlayVisible` flag, defaulting to false. It's saved on the game session (MikroORM migration, non-null boolean defaulting to false) and restored after a restart.
- [ ] New admin action `TOGGLE_JOIN_OVERLAY`, included in socket payload validation and allowed for the same roles as `TOGGLE_LEADERBOARD`. It flips the flag, is legal from every status except `lobby` and `ended`, and is otherwise refused as an illegal transition.
- [ ] Any transition that lands on `lobby` or `ended` clears the flag. That includes End quiz while the overlay is up.
- [ ] The shared on-air screen projection has a `join_overlay` screen kind with its own screen key, shown while the flag is set. The phone screen projection and the players view ignore the flag.
- [ ] The admin view exposes the flag.
- [ ] `/display` draws the join overlay using the QR, join code and team-size block pulled out of the lobby screen into a component both screens share. The QR value is still `/play?code=<joinCode>`, and the roster isn't shown.
- [ ] `/control` has a Toggle join overlay button next to Toggle leaderboard in the admin actions, desktop sidebar and mobile admin bar. It shows a pressed state while the overlay is up and isn't offered in `lobby` or `ended`.
- [ ] Backend gateway tests against a real database cover:
  - the toggle being refused in `lobby` and `ended` and accepted elsewhere;
  - the display's on-air screen becoming the join overlay while the players' phone screen stays unchanged;
  - an open question's lock deadline staying the same across show and hide (frozen clock);
  - End quiz clearing the flag;
  - the flag surviving a save and restart restore.
- [ ] Frontend tests cover `/display` drawing the join overlay screen kind and the `/control` button sending the action and reflecting the pressed state.
- [ ] `DOCUMENTATION.md`: the admin actions table gets the `TOGGLE_JOIN_OVERLAY` row, and the "leaderboard is not a status" note is extended to cover the join overlay.
- [ ] The `/guide` page explains when to use the join overlay.
