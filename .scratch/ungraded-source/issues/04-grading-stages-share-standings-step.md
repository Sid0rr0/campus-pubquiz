# 04: The grading stages end through one standings step

**What to build:** `ensureBlockGraded`, `ensureKahootSpeedScored` and `regradeQuestions` in the block grading module each end by fetching the leaderboard and returning the session with it. They share one private step for that instead of three copies. The standings fetches elsewhere in the Live session module (team removed, bonus changed, answer change) are deliberately not merged into it: they fetch and then apply in one synchronous update, and a shared "return the session" helper would invite a lost-update race across the `await`. Nothing changes on stage.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** 02 (same file; avoids a merge fight)

**Status:** done

- [x] The three grading stages call one private step to refresh the leaderboard; the three inline fetch-and-apply copies are deleted
- [x] `teamRemoved`, `bonusChanged` and the answer-change path are unchanged
- [x] Existing leaderboard, kahoot scoring and live-edit regrade specs pass unchanged

## Comments

Implemented as a private `withFreshLeaderboard` in `block-grading.service.ts`; committed on main (see git history for the hash). Full suite, typecheck and lint pass; code review found nothing.
