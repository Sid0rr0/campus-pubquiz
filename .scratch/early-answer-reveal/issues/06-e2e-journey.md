# 06: E2E journey for Early answer reveal

**What to build:** A new Playwright journey (its own spec file) that runs a two-block pub quiz with **Early answer reveal** on, from the lobby to `ended`, with the big screen and one phone (see the [spec](../spec.md)).

**Blocked by:** 04, 05

**Status:** done

- [ ] After the lock, the big screen shows the answers title card, then each question with its correct answer; the phone shows its own answer beside the correct one with no verdict
- [ ] Leaving the break is refused while a free_text answer is ungraded, then opens the leaderboard on the next round intro once graded; the phone shows its verdicts
- [ ] Advancing through the ranks hides the leaderboard and uncovers the round intro
- [ ] Previous from the next round intro goes back to the break card, then into the last answers question
- [ ] The last block's break goes straight to the final screen
- [ ] Passes `pnpm e2e --repeat-each=5`
