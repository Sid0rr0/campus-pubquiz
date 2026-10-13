# 03: Prune the dead grading-mode exports

**What to build:** Scoring stops exporting grading-mode lists and predicates that no production code reads, so nothing suggests callers should branch on grading mode. Nothing user-visible changes.

Parent spec: `.scratch/grading-state/spec.md`

**Blocked by:** 01 (both edit Scoring)

**Status:** ready-for-agent

- [ ] The auto-graded type list, the match-or-human type list, `isAutoGradedType` and `isMatchOrHumanType` are deleted, along with the scoring and registry-parity test assertions that exist only to pin them.
- [ ] `isBatchGradedType` and the batch list stay while the closest-guess reveal and block reveal views still call them (candidate 1 deletes them); `KAHOOT_ALLOWED_TYPES` and `hasMarginType` stay.
- [ ] A repo-wide search finds no remaining reference to the deleted names.
- [ ] `pnpm typecheck` and the shared-types tests pass.
