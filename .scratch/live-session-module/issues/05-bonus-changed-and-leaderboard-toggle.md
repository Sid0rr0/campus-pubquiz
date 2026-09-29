# 05: Bonus changed and leaderboard toggle

**What to build:** These all go through the Live session module and the outcome delivery step, which refresh the leaderboard by the same rule as grading:
- socket bonus awards
- REST edits and deletions of bonus awards
- toggling the leaderboard on

The awarded team's BONUS_AWARDED notice travels in the outcome. See the spec's user stories 11 and 12 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Test (real-store harness): after a socket bonus award, the next snapshot's leaderboard includes the bonus, and the awarded team's socket receives BONUS_AWARDED.
- [ ] Test: after a REST bonus edit/delete notification, the next snapshot's leaderboard reflects it.
- [ ] Test: toggling the leaderboard on after auto-graded submits shows every team's current totals, including 0-point teams.
- [ ] Invalid bonus awards are still rejected with today's messages.
