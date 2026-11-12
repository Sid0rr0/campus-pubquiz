# 01: Points gained: "+x" and the pub quiz count-up

**What to build:** On the big-screen leaderboards that show a block's results, the room sees how much each team gained (see the [spec](../spec.md)). In a pub quiz, the bottom-up rank walk stays, and each row, as its rank is revealed, counts up from the team's prior total to its new total. Quickfire keeps its existing hold → count-up → reorder sequence. In both modes a floating "+x" (green) or "−x" (red) sits just outside the row's right border and fades about 2 s after the row settles. A leaderboard brought up mid-block stays plain, as today.

- **Results window:** from the prior standings' block starting its results (its `reveal_intro`, or, with Early answer reveal, leaving its break) until the next block's first question opens, plus the final board. In quickfire: the between-questions count-up board. Decided once in the shared board description, never on the frontend.
- **Board field:** `pointsGained` (team id → current total minus prior standings total, nearest half point), present only inside the window. It lists only shown (capped) teams, and leaves out teams missing from the prior standings and teams on exactly 0.
- **Component:** a pub quiz row counts up from `total − gained` on its entrance. The count-up is cut to its end when a newer rank is revealed, like the entrance. The final board's list rows count up too, and the podium is unchanged. With reduced motion, the total swaps instantly and the "+x" is static (it still fades as plain opacity). The "+x" has a text label such as "gained 3 points".
- **Docs:** the leaderboard board section of `DOCUMENTATION.md` (the field and the window).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `pointsGained` is present at the pub quiz reveal, at the next block's round intro, after the break with Early answer reveal, on the final board, and on the quickfire between-questions board
- [ ] No `pointsGained` on a leaderboard brought up while a block is being answered, locked or in break
- [ ] Newcomers and zero gains are left out, negative gains are kept, and joker doubling and bonuses are included in the gain
- [ ] A revealed pub quiz row starts at `total − gained` and ends at its total, and a newer reveal cuts the count-up short
- [ ] The "+x"/"−x" renders outside the row with its label and fades, and there's none without an entry
- [ ] Reduced motion renders final values statically
- [ ] `DOCUMENTATION.md` updated
