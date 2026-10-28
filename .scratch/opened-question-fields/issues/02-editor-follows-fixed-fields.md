# 02: The quiz editor fixes only what the live-edit guard fixes

**What to build:** On an opened question, the quiz editor disables exactly the controls whose saved field is on the live-edit frontier's fixed list. Each control is mapped to the saved field it writes: multiple choice option text, sort items and match items save as choices, and match targets save as match targets. A control that writes two saved fields stays disabled if either is fixed. Everything else stays editable: the Scoring select (scoring mode) on sort and match, the margin row, points, the answer, the correct-choice radio, prompt, notes and media. A quiz master can now change an opened sort or match question's scoring mode mid-night, and saving re-scores its answers like any key fix. The opened-question notice says that changing the answer, points or scoring re-scores auto-graded answers. `DOCUMENTATION.md` says a scoring mode change on an opened question re-scores, next to the existing margin line. No `/guide` change.

**Blocked by:** 01 (Move the opened question's fixed fields into the live-edit frontier)

**Status:** ready-for-agent

- [ ] Editor controls' disabled state on an opened question comes from the frontier's fixed list, mapped per control to the saved field it writes
- [ ] The Scoring select is enabled on an opened sort or match question, and changing it updates the draft's scoring mode
- [ ] Type buttons and every choice, sort item, match item and match target control are disabled on an opened question; an unopened question has every control enabled
- [ ] Margin row, points, answer and correct-choice radio stay enabled on an opened question
- [ ] The editor never offers a change the guard would refuse (a control writing a fixed field alongside another stays disabled)
- [ ] The opened-question notice mentions scoring
- [ ] New quiz editor component test covers opened and unopened multiple choice, sort, match and number questions as above
- [ ] `DOCUMENTATION.md` gains the scoring mode re-score sentence
