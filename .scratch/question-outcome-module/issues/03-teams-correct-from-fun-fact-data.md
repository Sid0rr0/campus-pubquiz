# 03: Teams correct reads fun fact data; the verdict tallies read is deleted

**What to build:** On a question's `reveal` step, the big screen's teams-correct count ("7 of 12 teams, +2 close") takes its correct and partial counts from the **Question outcome** of that question's answers in the session's fun fact data. That data already holds roster answers only, so the figures are unchanged. The count is hidden on a question whose type has no correct rate, decided by `hasMeaningfulCorrectRate` instead of the reveal kind. Its team total stays the leaderboard length, and the wire shape `{ correct, partial, teamCount }` is unchanged.

The Standings module's verdict tallies read is deleted, along with the verdict tally type and the session record's tally field and its empty default. The live results read now reads two figures: the leaderboard and fun fact data.

See the spec's "Readers → Teams correct", "Deletions" and "Docs" sections.

Parent spec: `.scratch/question-outcome-module/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] `teamsCorrect` is still null outside a reveal, and null on a question for which `hasMeaningfulCorrectRate` is false. Otherwise its counts come from the Question outcome over fun fact data.
- [ ] The verdict tallies read, the verdict tally type, the session's tally field, its default and the live results read's tally entry are gone. No reference to them is left in the backend, shared types, frontend or test fixtures.
- [ ] The fun fact data read keeps its roster-only filter. Its name and type are unchanged. Its doc comment, and the fun fact data comment in the fun facts module, say that the reveal's teams-correct count reads it too.
- [ ] The teams-correct real-store spec passes:
  - its cases (correct and partial counted separately, every roster team in the total, no count outside a reveal, none on a closest_guess reveal, rebuilt after a restart) pass unchanged;
  - the case that made only the tally read fail is rewritten: when the fun fact data read fails, the count keeps its earlier value while the leaderboard updates.
- [ ] The live results placement spec's tally-read failure case moves to the fun fact data read. The single-room fields spec and the frontend room view fixture drop the tally field. The Standings service spec loses any tally-read cases.
- [ ] Docs, in the same change:
  - GLOSSARY.md's **Live results** reads "the leaderboard and fun fact data";
  - DOCUMENTATION.md's teams-correct paragraph says the counts come from the session's fun fact data and "no count" follows the question type's correct-rate setting (today only closest_guess);
  - DOCUMENTATION.md's live results reads sentence drops "tallies";
  - docs/architecture.md drops the tally read from any diagram that lists it.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once.
