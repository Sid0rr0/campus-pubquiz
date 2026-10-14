# 02: The server sends one leaderboard description, and the rows keep only the animation

**What to build:** The display view carries one complete leaderboard description: entries already capped, the reveal count, a count-up board present only for the between-questions kahoot board, and each team's trend. The server decides the trend basis, the all-tied rule and the kahoot top-five cap in one place, so the reveal walk and the drawn board can't disagree and a backend spec can assert every arrow. The display renders the description as sent, and the leaderboard rows module shrinks to the animation phases. The room sees exactly what it sees after ticket 01.

Parent spec: `.scratch/leaderboard-before-board/spec.md`

**Blocked by:** 01 (prior standings on the server)

**Status:** done

- [ ] The Screen projection builds the description for the display view. The trend basis is the prior standings in a kahoot round (between questions, round end and quiz end), otherwise the standings with the current round's points backed out, and otherwise no trend. Every team is `up` on an all-tied real prior board with more than one team, and a team missing from the basis has no trend. Ranks are compared with the shared ranking rule.
- [ ] The kahoot top-five cap (first five by final standing, splitting a tie at the cutoff) is applied by the same shared module that gives the reveal walk its step count; the description's entries arrive capped.
- [ ] The display no longer reads the kahoot flag, the between-questions flag or the top-five constant to draw the leaderboard; it passes the description straight to the component. Flags still used by other screens stay.
- [ ] The leaderboard rows module keeps only the animation: old board, count up, settle; reveal bottom-up by the reveal count; show the sent trends only once settled. The three trend bases, the round-backed-out approximation and the all-tied case leave it.
- [ ] Backend real-store specs assert the description: capped entries and count-up board between kahoot questions; no count-up board, one-rank-at-a-time reveal and the cap at a kahoot round end; trends against prior standings for kahoot and against the round backed out for an ordinary round; all-tied gives every team `up`; the reveal walk's step count matches the capped entries; no count-up board on the first board after a simulated restart.
- [ ] Leaderboard component tests render from description fixtures: with a count-up board it holds, counts up and settles in the new order; without one it draws settled rows; trends appear only once settled, exactly as sent. The rows test's trend-basis cases are removed (now covered by the backend).
- [ ] DOCUMENTATION.md (display view fields, kahoot leaderboard) and docs/architecture.md (if it shows the display remembering a board) are updated.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend and frontend tests pass.
