# Spec: The quiz editor and the live-edit guard share one opened-question rule

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-28, candidate 3 ("Share the opened-question freeze rule with the quiz editor"). Seams agreed with the user in the same session.

## Problem Statement

While a session is running, the quiz master can fix an **Opened question** in the quiz editor: its prompt, answer, points, notes and media. Its type and choices stay fixed, because teams have already answered against them. Changing the **Answer key** of an opened question is a key fix: its answers are re-scored.

Two places decide which fields of an opened question are fixed, and they disagree:

- The live-edit guard, which refuses a bad save, fixes the type, the choices and the match targets. It lets the **Scoring mode** of a sort or match question change, and the save then re-scores its answers, like any other key fix.
- The quiz editor disables the Scoring select on an opened question. So a quiz master who sees that a sort question should have given partial credit (per item or one off instead of exact) can't change it during the night. The backend path that would re-score it can't be reached from the UI.
- The editor treats the two grading settings differently: a Number question's margin can be changed when opened, but the scoring mode can't.

Nothing tests which editor controls are disabled on an opened question, which is how the two lists drifted apart.

## Solution

There is one list of the fields an opened question keeps fixed, kept in the shared live-edit frontier module that the editor already reads its round rules from. The live-edit guard refuses changes to exactly those fields, and the quiz editor disables exactly the controls that write them. Everything else on an opened question, the scoring mode included, can be changed, and a change to its answer key re-scores its answers.

For the quiz master: on an opened sort or match question the Scoring select now works. Saving a new scoring mode re-scores that question's answers, as changing its answer or points already does. The opened-question notice in the editor says so.

## User Stories

1. As a quiz master, I want to change the scoring mode of an opened sort question during the night, so that I can turn on partial credit when "exact order only" proves too harsh.
2. As a quiz master, I want to change the scoring mode of an opened match question, so that I can switch between points per pair and half points for one mistake.
3. As a quiz master, I want a scoring mode change on an opened question to re-score its answers when I save, so that the leaderboard reflects the new rule.
4. As a quiz master, I want the opened-question notice to say that changing the answer, points or scoring re-scores auto-graded answers, so that I know what a save will do.
5. As a quiz master, I want the type of an opened question to stay fixed, so that teams' answers keep meaning what they meant.
6. As a quiz master, I want the choices of an opened multiple choice question to stay fixed (text, adding and removing), so that a fixed typo can't zero every team that picked it.
7. As a quiz master, I want to still mark a different choice as correct on an opened multiple choice question, so that I can fix a wrong answer key.
8. As a quiz master, I want the items of an opened sort question to stay fixed (text, adding and removing), so that the order teams submitted still lines up.
9. As a quiz master, I want to still reorder an opened sort question's correct order, if the editor allows reordering, so that I can fix a wrong key. (Only if reordering writes the answer and not the items; otherwise it stays as it is today.)
10. As a quiz master, I want the items and targets of an opened match question to stay fixed, so that the pairs teams submitted still line up.
11. As a quiz master, I want to still change the margin of an opened Number question, so that I can loosen it when a key was too tight.
12. As a quiz master, I want to still change the points, answer, prompt, notes and media of an opened question, so that I can fix mistakes mid-night as today.
13. As a quiz master, I want every control on a question no session has opened to stay editable, so that upcoming questions are edited freely as today.
14. As a quiz master, I want the editor to never offer a change the save will refuse, so that I don't find out only when I press Save.
15. As a quiz master, I want the editor to never block a change the save would accept, so that every allowed fix can be reached.
16. As a developer, I want one list of the fields an opened question keeps fixed, so that the guard and the editor can't drift apart again.
17. As a developer adding a new question field, I want to decide in one place whether it freezes once opened, so that the guard and the editor both follow.
18. As a developer, I want a component test that pins which controls are disabled on an opened question of each type, so that the next drift fails a test.

## Implementation Decisions

- **Opened question fixed fields live in the live-edit frontier module** (shared types): the list of saved question fields an opened question keeps fixed. Today these are the type, the choices (`options`) and the match targets. The module exports the list, or a small predicate over it. The live-edit guard reads it instead of holding its own copy, and its refusal message and behaviour are unchanged.
- **The quiz editor disables a control when the field it writes is on the list and the question is opened.** The editor's draft shape differs from the saved shape. Multiple choice option text, sort items and match items all save as choices, and match targets save as match targets, so each control is mapped to the saved field it writes. Controls whose field is not on the list stay enabled on an opened question:
  - the Scoring select (scoring mode);
  - the margin row;
  - points, answer, prompt, notes and media;
  - the correct-choice radio on multiple choice.
- **Scoring mode is editable on an opened question.** It is part of the Answer key (`GLOSSARY.md`), so a change is a key fix. The backend already re-scores it, and the editor's existing regrade warning and save path handle it with no change. The accepted tradeoff in `CLAUDE.md` (a live answer-key fix overwrites manual overrides, such as adjusted per-item credit) applies as for any key fix.
- **Opened-question notice:** the editor's notice on an opened question changes to say that changing the answer, points or scoring re-scores auto-graded answers.
- Check how each control works today before mapping it. If one writes two saved fields at once (for example, if reordering sort items in the editor rewrites both the items and the correct order), it stays disabled when either field is fixed. That keeps the editor from offering a save the guard refuses (story 14).
- No backend behaviour change, no protocol, schema or migration change.

## Testing Decisions

- A good test renders the question editor as the quiz master sees it and asserts what can and can't be changed: disabled controls, by accessible name or label. It doesn't assert how the disabled flag was computed.
- **Quiz editor component test (primary seam):** for an opened question of each type with type-specific controls (multiple choice, sort, match, number), assert:
  - the type buttons and every choice, item and target control are disabled;
  - the Scoring select (sort and match), the margin row (number), points, the correct-choice radio and the answer stay enabled;
  - an unopened question of the same type has every control enabled.

  Add one case where changing the Scoring select on an opened sort question changes the draft's scoring mode.
- **Backend:** the live-edit guard spec and the live-edit regrade specs (including "re-scores a sort question when its scoring mode changes") pass unchanged. They're the proof the guard's behaviour didn't move.
- **Shared:** if the list becomes a predicate, add one direct case in the live-edit frontier tests: fixed for type, choices and match targets; not fixed for scoring mode, margin, answer and points. A plain exported list needs no test of its own.
- Prior art: the quiz editor panel component test and the quiz draft state tests (frontend), the live-edit guard spec and the live-edit regrade spec (backend), and the live-edit frontier tests (shared).

## Out of Scope

- Changing which fields are fixed. The list stays type, choices and match targets; this spec only makes the editor follow it.
- Loosening or tightening the round- and block-level live-edit rules (ADR 0002 stands).
- The scoring-mode labels' wording, and where they live (covered by the scoring mode registry spec).
- Undoing the "key fix discards manual overrides" tradeoff.
- `/guide` changes: nothing on `/control` changes, and the guide doesn't describe live edits of opened questions.

## Further Notes

- `DOCUMENTATION.md`: next to the existing line that says changing an opened Number question's margin re-scores its answers, add that changing an opened sort or match question's scoring mode does the same.
- Overlap watch: the scoring mode registry spec also touches the editor's Scoring select (labels). Whichever lands second rebases. Neither changes the other's behaviour.
