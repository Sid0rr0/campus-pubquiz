# 04: Clickable T and B markers

**What to build:** The quiz master can click any round's T marker to see its title card, or any B marker to see its break card, in the detail column, to look ahead or back while the big screen stays put. A browsed title card that isn't on air has no kind label. The selected marker is highlighted like a selected question. The detail column follows the big screen again automatically once Advance or Previous brings the big screen onto the clicked item, for T and B as for questions today. There is no "follow big screen" button. The green "live on display" ring keeps marking what's on air.

**Blocked by:** 03

**Status:** done

- [ ] T and B markers are buttons with accessible labels; clicking shows that card
- [ ] Browsed title card shows no kind label; on-air one does
- [ ] Selection drops when the on-air item equals it (question, title card or break)
- [ ] Selected marker highlighted; on-air ring unchanged
- [ ] No grading list while a browsed card is shown
- [ ] `/control` page tests cover clicking T and B and the snap-back
- [ ] Guide text for this change goes to ticket 05
