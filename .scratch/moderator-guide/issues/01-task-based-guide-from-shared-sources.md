# 01: Rewrite `/guide` around the moderator's tasks, fed from the app's own sources

**Status:** needs-triage

**What to build:** The `/guide` page (`apps/frontend/app/guide/guide-content.tsx`) is the moderator's guide to running a quiz night. It is hand-written prose that has drifted from the app:

- its lifecycle still says `question open → locked → break (grading)` — there is no locked status, and it skips the round overview, round title cards, locking and break review (see `CONTEXT.md` and DOCUMENTATION.md's Statuses table)
- it says grading happens during the break — grading can happen as soon as an answer arrives; the break is where it must be finished
- the per-type CSV bullets and the keyboard shortcut list are copies of facts that live in code (`QUESTION_KINDS` in `shared/types/src/question-kind.ts`, `apps/frontend/app/control/use-admin-keyboard-shortcuts.ts`), so they go stale whenever those change

Rewrite it as task-oriented sections in the glossary's language (no status names): before the night, starting a session, running questions, grading, the break and break review, the reveal, the leaderboard, ties and showdowns, teams, ending, and creating a quiz. Facts that are lists in code are rendered from those lists rather than restated:

- the per-question-type authoring and grading notes come from the question type registry (add a short moderator-facing description per entry if none exists)
- the keyboard shortcuts come from the same definition `use-admin-keyboard-shortcuts.ts` reads (extract it to a shared constant if needed)

Then pin it with a test so drift fails CI instead of reaching a quiz night.

- [ ] Sections follow the moderator's tasks; the page uses glossary terms (block, break, break review, round title card, question type) and no raw status names
- [ ] Lifecycle and grading text match `CONTEXT.md` / DOCUMENTATION.md: no `locked` status, grading allowed before the break and required to finish in it
- [ ] Per-type notes are rendered from the question type registry, so a new type shows up in the guide without editing it
- [ ] Keyboard shortcuts are rendered from the shortcut definitions the control page uses
- [ ] A guide test asserts every question type and every shortcut appears, and that no raw status name (`locked`, `question_open`, `break_round_intro`, …) does
- [ ] `CLAUDE.md`'s "Keeping docs current" rule (moderator-visible changes update `/guide`) is satisfied by this structure
