# 02: Perfect rounds 🔥 on the leaderboard

**What to build:** A team gets an animated 🔥, to the right of its total, for each **Perfect round** (see `GLOSSARY.md` and the [spec](../spec.md)) it had in the block just scored. Two perfect rounds give 🔥🔥. It shows on the same boards as ticket 01's "+x" (the results window), but never on the final board.

- **Check first:** whether a quickfire quiz shows a leaderboard after a round's last question. The between-questions count-up board only appears while the next question is open underneath. Make the 🔥 appear on the board that follows a round's last question. If there's no such board, record what you found in this ticket's Comments and settle the placement with the user before building the quickfire part.
- **Perfect-round helper (shared types):** one pure helper that both this ticket and ticket 03 use. A round is perfect for a team when it has a `correct` verdict on every question of the round whose type has a meaningful correct rate (closest-guess questions are left out, as in the clean sweep). A round with no such question is never perfect. Partial, incorrect and missing answers break it. It reads verdicts from the session's fun fact data.
- **Board field:** `perfectRounds` (team id → count of perfect rounds in the prior standings' block), present only inside the results window, never on the final board. It lists only shown teams and leaves out teams with 0.
- **Component:** one 🔥 per perfect round right of the total, with a small looping flicker, static under reduced motion. It has a text label such as "2 perfect rounds".
- **Docs:** the leaderboard board section of `DOCUMENTATION.md`.

**Blocked by:** 01 (Points gained: "+x" and the pub quiz count-up)

**Status:** ready-for-agent

- [ ] `perfectRounds` counts multiple perfect rounds in the block, and partial or unanswered answers break a round
- [ ] Closest-guess questions are left out, and a round of only closest-guess questions is never perfect
- [ ] A correct Clue answer on any clue, and a correct but slow quickfire answer, count
- [ ] No `perfectRounds` outside the results window or on the final board
- [ ] The quickfire round's-end board shows the 🔥 (or the finding is recorded and the user has settled it)
- [ ] The component draws one 🔥 per perfect round right of the total, with its label, and static under reduced motion
- [ ] `DOCUMENTATION.md` updated

## Comments

- Check first: the board exists. After a quickfire round's last question reveal, `advanceFromReveal` falls through to `leaveBlock`, which lands on the next round's `round_intro` (`furthestOpenIndex` -1) with the leaderboard up. The results window now includes it for quickfire rounds too, for both `pointsGained` and `perfectRounds`.
