# 04: Stats read the verdict

**What to build:** Session stats count a question's correct answers by stored verdict (correct only; partial no longer counts toward the correct-count), so stats agree with what the grading panel showed live, and kahoot rounds' speed-scaled correct answers count. Match questions keep their points-based per-question rate. Round-level rate consistency stays out of scope (Standings candidate). See [spec](../spec.md) user stories 20–23.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Session-detail calculation tests: correct-count uses verdict, speed-scaled kahoot correct answers count, partial match answers don't count toward the correct-count, and match's rate stays points-based.
- [ ] Stats service Postgres tests still pass with backfilled historical verdicts.
- [ ] The stats detail page shows the new counts without UI changes beyond what the data implies.
