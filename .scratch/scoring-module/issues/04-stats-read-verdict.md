# 04: Stats read the verdict

**What to build:** Session stats count a question's correct answers by stored verdict (correct only; partial no longer counts toward the correct-count), so stats agree with what the grading panel showed live, and kahoot rounds' speed-scaled correct answers count. Match questions keep their points-based per-question rate. Round-level rate consistency stays out of scope (Standings candidate). See [spec](../spec.md) user stories 20–23.

**Blocked by:** 03

**Status:** done

- [x] Session-detail calculation tests: correct-count uses verdict, speed-scaled kahoot correct answers count, partial match answers don't count toward the correct-count, and match's rate stays points-based.
- [x] Stats service Postgres tests still pass with backfilled historical verdicts.
- [x] The stats detail page shows the new counts without UI changes beyond what the data implies.

## Comments

Implemented in `feat(backend): count stats correct answers by stored verdict`. Status set to `done`.

- `isCorrect` in `session-detail.calc.ts` is now `verdict === 'correct'`; the stats service selects `a.verdict`. Team, round and non-match question correct-counts/rates all use it (the round-level rate change is a side effect of sharing the helper, not a separate decision). Match keeps its points-based rate.
- No frontend change was needed.
