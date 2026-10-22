# 03: Standings, ratings and feedback in the brief

**What to build:** the session-level sections of the brief.

- **Player totals:** total and number of teams that reported.
- **Score spread:** top, median and bottom share of max points.
- **Standings with no team names:** placing ("Joint 2nd", "left"), points (bonus awards counted, not itemised), share of max points, player count.
- **Highlights:** the hardest and easiest question, using the stats page's rules.
- **Each round:** star rating (average and count, "no ratings" when none) and correct rate.
- **Feedback:** topic suggestions grouped by `groupTopics` with counts, and comments as written (newest first, blank ones skipped). When `collectFeedback` was off, one line saying feedback was off instead.

Parent spec: `.scratch/night-brief/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Pure calc tests: standings order and ties match the Session result; departed teams shown as "left"; no team name anywhere (assert fixture names absent)
- [x] Ratings and correct rates per round; a round of only `closest_guess` questions has no rate
- [x] Feedback on and off; topics grouped; blank comments skipped
- [x] `DOCUMENTATION.md` Night brief subsection updated
