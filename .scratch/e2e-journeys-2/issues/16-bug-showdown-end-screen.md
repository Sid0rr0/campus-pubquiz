# 16: Bug: no "Quiz complete!" or final placing after a decided showdown

Found by: ticket 04 (showdown journey).

**Status:** needs-triage

`DOCUMENTATION.md` (the `ended` row of the status table, and "The final placing is drawn from the snapshot's leaderboard") and the `/guide` page say that once a showdown is decided the phone shows "Quiz complete!", the team's final placing ("You finished 1st of 2") and the final feedback form, and that `/display` shows the ended screen with the podium.

Observed: after the showdown's last reveal step, `describeOnAirScreen` keeps returning `{ kind: 'showdown' }` for status `ended` for as long as the session has an `activeShowdown` (resolved or not). The big screen stays on the showdown reveal and each phone stays on `showdown_reveal`, with the "Rate the rounds" form appended below it but no "Quiz complete!" heading and no "You finished ..." line. The ended screen is reachable only through the leaderboard toggle.

The ticket 04 journey asserts the final placing through the leaderboard (podium and the phone's own standing), not through the ended screen, so it passes either way.

Either the code should leave the showdown screen once the showdown is decided, or the docs should say the showdown screen stays on air.
