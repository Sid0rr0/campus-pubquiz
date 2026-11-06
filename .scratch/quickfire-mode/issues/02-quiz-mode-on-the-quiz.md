# 02: The quiz carries the mode

**What to build:** `quizzes.mode` (`pub` | `quickfire`) replaces the per-round flag in storage; sessions fill each round's in-memory flag from it, and the editor enforces the mode.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Migration adds `quizzes.mode`, sets `quickfire` where every round is quickfire (and there is at least one round), `pub` otherwise, throws on a quiz mixing both, then drops `rounds.quickfire`. Spec covers the three cases.
- [ ] `seed.service.ts` / session state fill every round's in-memory quickfire flag from the quiz's mode; engine logic and its specs are otherwise untouched.
- [ ] REST quiz summary and draft carry `mode`; the round-level field is gone from `rest.ts`, `import.ts`, the draft schema and the round editor's toggle.
- [ ] The draft schema refuses a quickfire quiz holding a non-quickfire-allowed type (the existing message), and a save can't change `mode`.
- [ ] Editor: mode shown read-only; quickfire hides `break_after` and only offers allowed types; new questions default to 1000 points in quickfire, 1 in pub.
- [ ] Live-edit guard and frontier: the per-round "kahoot setting can change" rule is removed.
- [ ] Session picker prefills the timer from the quiz's mode.
- [ ] E2E: `full-night` drops its kahoot round; the quickfire spec's helper sets the mode on the quiz instead of a round (ticket 03 switches it to importing with the mode).
- [ ] `DOCUMENTATION.md` (data model, editor, live edits) and `/guide` updated.
