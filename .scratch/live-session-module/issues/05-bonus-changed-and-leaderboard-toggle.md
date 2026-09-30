# 05: Bonus changed and leaderboard toggle

**What to build:** These all go through the Live session module and the outcome delivery step, which refresh the leaderboard by the same rule as grading:
- socket bonus awards
- REST edits and deletions of bonus awards
- toggling the leaderboard on

The awarded team's BONUS_AWARDED notice travels in the outcome. See the spec's user stories 11 and 12 ([spec](../spec.md)).

**Blocked by:** 02

**Status:** done

- [x] Test (real-store harness): after a socket bonus award, the next snapshot's leaderboard includes the bonus, and the awarded team's socket receives BONUS_AWARDED.
- [x] Test: after a REST bonus edit/delete notification, the next snapshot's leaderboard reflects it.
- [x] Test: toggling the leaderboard on after auto-graded submits shows every team's current totals, including 0-point teams.
- [x] Invalid bonus awards are still rejected with today's messages.

## Comments

Implemented in the commit recorded in `.scratch/overview.md`. `Status:` set to `done`.

- `GameStateService.bonusChanged(joinCode, awarded?)` recomputes the leaderboard and returns an outcome; a fresh socket award carries the `BONUS_AWARDED` notice for the team's socket. `awardTeamBonus` and `GameGateway.notifyBonusAwardsChanged` (REST edit/delete) both go through it and `deliverOutcome`. The notice is now emitted after the room push rather than before.
- The leaderboard toggle already refreshed via `applyAdminAction` (ticket 02); ticket 05 adds the test that pins it, including 0-point teams.
- The real-store harness gained `inRequestContext` so a spec can call services directly the way a REST controller would.
