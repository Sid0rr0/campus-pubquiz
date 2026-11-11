# 03: Results after the break come on the leaderboard

**What to build:** With **Early answer reveal** on, Advance out of the break (still refused while any answer in the block is ungraded) goes to the next block's `round_intro` with the leaderboard up, or to `ended` after the last block. The post-break `reveal_intro`/`reveal` walk no longer runs (see the [spec](../spec.md)).

- The leaderboard opens on every forward move out of a break (rank reveal count reset), never on Previous. The existing leaderboard Advance then applies: ranks one by one, then hide it to uncover the round intro. Versus's side bar shows as on any leaderboard.
- The leaderboard's visibility is saved progress, so a restored session shows it again (with its ranks to reveal again).
- **Phones:** while that leaderboard is up, phones show the block browser of the block just graded in its revealing mode (own answer with verdict colours, correct answer, points) instead of the leaderboard.
- Prior standings are unchanged: the board counts up from this block's prior standings.
- **Docs:** `DOCUMENTATION.md` status table and phone screen. The `/guide` text goes in ticket 07.

**Blocked by:** 02

**Status:** done

- [ ] Move plan tests: leaving the break goes to the next block's `round_intro` with the leaderboard visible, and to `ended` after the last block; the ungraded refusal still applies
- [ ] Re-entering the break by Previous and leaving it again opens the leaderboard again
- [ ] Screen projection tests: under that leaderboard, the phone shows the graded block browser with verdicts
- [ ] Commit a move spec: the exit from the break is refused while ungraded, and a committed exit saves progress with the leaderboard visible
