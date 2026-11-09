# 04: Clue question fun facts

**What to build:** Two new break **fun facts** about Clue questions, drawn only from blocks already revealed, like every fun fact:

- **Cracked it early:** "The Quizzly Bears cracked *Who am I?* on the first clue". It names the teams with the earliest correct answer, and appears only when that clue is before the last one.
- **Last gasp:** "Nobody got *Who am I?* until clue 5". It appears when the question's earliest correct answer came after clue 1.

A Clue question nobody got right is already covered by the existing "nobody got it" fact. The fun fact data needs each answer's clue, which ticket 03 records.

Update DOCUMENTATION.md where fun facts are listed. Any `/guide` text goes in ticket 05.

**Blocked by:** 03

**Status:** done

- [ ] Both facts appear with the right teams, question and clue (fun-facts tests)
- [ ] Neither fact draws from the block in play
- [ ] "Cracked it early" is skipped when the earliest correct answer came on the last clue, and "last gasp" is skipped when it came on clue 1
- [ ] The big screen renders both facts
- [ ] DOCUMENTATION.md is updated
