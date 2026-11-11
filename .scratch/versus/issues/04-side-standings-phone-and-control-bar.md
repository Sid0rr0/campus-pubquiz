# 04: Side standings and the bar on phones and /control

**What to build:** Teams and the quiz master see which **Side** is ahead. The phone leaderboard and `/control` show a bar split by each side's share, with each side's average points and percentage. The phone highlights the team's own side (see the [spec](../spec.md)).

- **Side standings module (new, shared types, pure):** takes the full leaderboard entries (not the capped board), each team's side, which teams count (they took part and haven't left, by the leaderboard's own rule) and the session's sides. Returns, per side and in side order:
  - id, name and colour index
  - counted team count
  - average total (null when no team counts)
  - share
  - whether it leads

  It also says whether the lead is tied. Share is the average floored at 0, divided by the sum of floored averages. When that sum is 0, every side gets an equal share. It is called once for the current standings, and ticket 05 calls it again for the prior standings.
- **Views:** the players view's phone leaderboard and the admin view carry the current side standings, computed from session state on every emit, so a side pick or move updates the bar without a scores read. Nothing is sent with Versus off.
- **Phone:** the bar on the leaderboard phone screen with the team's own segment highlighted. "No teams" shows on an empty side.
- **`/control`:** the same bar, near the existing leaderboard and standings.

**Blocked by:** 02, 03

**Status:** done

- [ ] Module: averages with uneven team counts; a negative average floored for the share but shown as is; all zeros split evenly; an empty side shows 0% and no average; teams that left or didn't take part excluded; lead and tie (shared types test, following `leaderboard-board.test.ts`)
- [ ] Players and admin views carry the side standings with Versus on and nothing with it off; a move changes them without a scores change (gateway spec)
- [ ] Phone bar: shares, averages, own side highlighted, "no teams" (play component test)
- [ ] `/control` bar renders the side standings (control component test)
- [ ] `DOCUMENTATION.md` updated for the view fields
