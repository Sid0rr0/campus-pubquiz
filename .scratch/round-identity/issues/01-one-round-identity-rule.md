# 01: Round identity: one rule for the guard, the jokers and the extra jokers

**What to build:** Across a live edit, the live-edit guard's Clue-on-doubled-round refusal and the jokers' and extra jokers' follow all decide "which round is this round now" with one **Round identity** rule. A save the guard lets through can then never leave a joker on a Clue round. A new database-free module holds the rule. Given the questions a round held before the edit and the rounds after it (each as its question ids; a new question has none), it returns the position of the round holding most of those questions, or none. The first round in quiz order wins a tie. A round with none of its questions left, or that had none, is gone. New questions never count. The guard, the joker follow and the extra-joker rebuild each map that position to what they need, and their own copies of the rule are deleted. Purchase changes no longer import from the joker module. Redrawing, removing and deduplicating jokers and extra jokers stays exactly as it is. Nothing changes for the quiz master or the teams. See the spec's "The Round identity module" and "Callers".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Round identity module tests (database-free): most questions wins; a tie goes to the first round; a round with none of its questions left is gone; a round that had no questions is gone; new questions without ids don't count; a reorder finds the round at its new position; questions moved into a fresh row are found there
- [ ] New live-edit save case (real Postgres): a doubled round's questions split evenly between two rounds; a Clue question added to the first is refused; one added to the second is accepted and the joker then sits on the first round
- [ ] Existing joker and extra joker follow cases, and the guard's Clue-on-doubled-round cases, pass without changing their expectations
- [ ] No copy of the rule is left in the guard or the joker module, and purchase changes don't import the joker module for it
- [ ] `GLOSSARY.md` has a **Round identity** entry near **Live-edit frontier**; `DOCUMENTATION.md`'s live-edit paragraph names it and its tie rule
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass; the database-free mutation run for the module and the guard, and `mutate:db` for the joker and purchase change modules, show no new survivors
