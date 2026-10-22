# 07: The phone during the joker round

**What to build:** While the phone shows a question of its joker round (answering, locked in the break, or revealing) it wears a joker border; questions of other rounds in the same block don't. When the joker round's intro comes on live, the phone plays a "2× POINTS" joker card animation, never on a reload, a reconnect or Previous. The joker round's break round intro and reveal intro carry a static joker badge. Once the joker round's block has been revealed, the chip reads "played".

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Border on joker-round questions in every block browser mode, none on other rounds' questions
- [ ] "2× POINTS" animation on the joker round's `round_intro`, live moves only (same live-change helper as the "Locked" stamp); respects reduced motion
- [ ] Static badge on the joker round's `break_round_intro` and `reveal_intro`
- [ ] Chip shows "played" once the joker round's block is revealed (the players view says so)
- [ ] Page specs from the `roomView` fixture for each state
- [ ] `DOCUMENTATION.md` phone column updated
