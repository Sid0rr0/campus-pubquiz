# 01: Rename the `grading` status group to name the break, not the act of grading

**Status:** needs-triage

**What to build:** The status group `GRADING_STATUSES` / `isGradingStatus` (break_intro, break, break_round_intro) is named after grading, but grading isn't limited to those statuses: the quiz master can grade an answer as soon as it arrives, during question_open. The group really answers "is the block in its break?". Rename it (e.g. `BREAK_STATUSES` / `isBreakStatus`) so the name matches the glossary's **Break** and **Grading** entries in `CONTEXT.md`. This is a behaviour-preserving rename: the members don't change.

Call sites today:

- `shared/types/src/game-state-groups.ts` (definition, plus the `graded` and `block review` groups built from it)
- `shared/types/src/game-state-structure.ts`
- `shared/types/src/game-state-timed-phase.ts`
- `apps/backend/src/game/state/block-grading.service.ts`
- `apps/frontend/app/control/break-end-time-control.tsx`
- `apps/frontend/app/play/question-browser.tsx`
- `shared/types/src/__tests__/game-state-groups.test.ts` (membership table)

- [ ] The group and its predicate are renamed everywhere; no `GRADING_STATUSES` / `isGradingStatus` remain
- [ ] Members are unchanged and the membership table test still passes
- [ ] `CONTEXT.md`'s status-group list uses the new name and drops the "named for the break's purpose" note
