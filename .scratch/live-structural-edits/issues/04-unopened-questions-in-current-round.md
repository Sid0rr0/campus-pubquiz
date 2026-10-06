# 04: Change unopened questions in the current round

**What to build:** The line moves into the current round. In a live session's current round, the questions after the last **opened question** can be added, reordered or deleted, or moved to a later round. Teams' phones only get questions up to the furthest opened one, so nobody sees the change until a question opens. Once the current block starts **locking**, and through its **break** and reveal, its rounds are frozen: adding a question then would put the locking countdown on a question that's no longer last, or add an unanswerable question to a locked block. The editor explains this and suggests a later round. A round must always keep at least one question.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] In the current round (status in **answering**, before locking), questions after the last opened one can be added, reordered, deleted, or moved to a later round. Opened questions keep their order and stay at the start of the round.
- [ ] Inserting a question before or between opened questions, or moving an opened question, is refused with a 409.
- [ ] From locking through the break and reveal, the current block's rounds can't gain, lose or reorder questions. The editor shows why.
- [ ] Removing the last question of a round is refused by the existing empty-round validation.
- [ ] After a save, the session carries on from the same opened question, and the next press opens the question now placed after it.
- [ ] Reconnecting clients (display, admin and players) get a full view that matches the edited round.
- [ ] Guard spec table cases and editor panel tests cover the above.
