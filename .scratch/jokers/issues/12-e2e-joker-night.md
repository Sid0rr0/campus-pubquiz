# 12: End-to-end joker night

**What to build:** One Playwright journey: a session with Jokers on and two teams. One team picks its joker round, the other doesn't and gets one drawn. The quiz plays through a block, the leaderboard is revealed, and the 2× stamp shows on the right row on the big screen and that team's phone, with the doubled total.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 05, 07, 08, 09

**Status:** done

- [x] Journey passes with `pnpm e2e` and with `--repeat-each=5`
- [x] Covers the pick, a draw, the border on a joker question, and the stamp with the doubled total
