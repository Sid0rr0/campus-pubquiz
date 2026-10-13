# 03: Join overlay meets the Move plan and the leaderboard

**What to build:** While the join overlay is up, the quiz master's next Advance or Previous press only hides it. The quiz never moves underneath a covered big screen, and the press after that moves the quiz as normal. Unlike the leaderboard, hiding the join overlay is always possible: Previous isn't refused, and it doesn't matter whether the status underneath can move. `/remote`'s "next" line says the press will hide the overlay. The join overlay and the leaderboard are never up together: showing the join overlay hides the leaderboard and resets its rank reveal, and showing the leaderboard hides the join overlay. The join overlay also gets a keyboard shortcut on `/control`, next to the leaderboard's. See `.scratch/join-overlay/spec.md` and the **Move plan** entry in `GLOSSARY.md`.

**Blocked by:** 02: Toggle join overlay

**Status:** done

- [ ] With the join overlay up, the Move plan plans a new hide step for Advance and Previous. Its effective action is `TOGGLE_JOIN_OVERLAY`, and it's always pressable.
- [ ] Backend gateway test against a real database: with the overlay up, Advance hides it without changing the status, Previous hides it rather than being refused, and the next press moves the quiz.
- [ ] Backend gateway test: with the overlay up on the rules, Previous hides it and a second Previous goes to the lobby. This only applies once 01 has landed; otherwise assert that the second Previous is refused.
- [ ] Showing the join overlay turns the leaderboard off and resets its reveal counter. `TOGGLE_LEADERBOARD` turning the leaderboard on turns the join overlay off. Covered in the shared state-machine guard tests and a gateway test.
- [ ] The presenter preview (`/remote`'s "next" line) describes hiding the join overlay while it's up. The screen-preview text has a heading for the join overlay screen.
- [ ] `/control` has a keyboard shortcut for Toggle join overlay that follows the leaderboard shortcut's rules (ignored while typing in a field), covered in the existing keyboard-shortcut tests.
- [ ] The `/guide` page mentions that Advance or Previous hides the join overlay first.
