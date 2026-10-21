# 02: Fun facts read the Question outcome

**What to build:** The break's fun facts work out how each revealed question went through the **Question outcome** module, with the live roster count (the leaderboard length) as the team count, as today. Which questions they leave out of the rate facts (toughest question, room split, nobody got it) and the clean sweep is now decided by the question type registry's correct-rate setting, not by whether the reveal kind is `closest_guess`. The big screen shows the same fun facts as before.

See the spec's "Readers → Fun facts" section.

Parent spec: `.scratch/question-outcome-module/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The fun facts' outcomes step builds each revealed question's outcome with the Question outcome module, and its own credit loop is deleted.
- [ ] The fun facts keep their own rules on top:
  - a question nobody answered yields no outcome;
  - a question with no correct rate yields no outcome;
  - "nobody got it" means a correct count of 0;
  - the toughest question and the room split read the rate.
- [ ] The internal revealed-question shape drops its "is closest guess" flag and carries the question type. The clean sweep leaves out questions for which `hasMeaningfulCorrectRate` is false.
- [ ] No reveal kind check is left in the fun facts module.
- [ ] Leave the fun fact data doc comment for ticket 03 to edit.
- [ ] The existing fun facts spec passes unchanged, including:
  - its closest_guess cases (left out of the rate facts and the clean sweep);
  - its toughest question, room split and nobody-got-it cases.
- [ ] Typecheck, lint and tests pass.
