# 02: Answer submitted or graded ends through the grading refresh

**What to build:** A team submitting or revising an answer, or the quiz master grading one, refreshes that question's ungraded marker and the leaderboard through the grading refresh from ticket 01. It no longer uses its own reader call, standings fetch and one-question update helper. Nothing changes on `/control`, the big screen or the phones. Afterwards there is one way to write the session's ungraded set.

Parent spec: `.scratch/grading-refresh/spec.md`

**Blocked by:** 01 (A live answer-key fix refreshes /control's ungraded markers).

**Status:** ready-for-agent

- [ ] The answer-change path gets the question's ungraded flag and the standings from the grading refresh, and applies them in the same synchronous update as the answered-team ids, keeping its fetch-then-apply shape.
- [ ] The one-question update helper for the ungraded set is deleted, or becomes the grading refresh's own way of applying its change. Nothing else writes the ungraded set.
- [ ] The outcome still names the question for a fresh admin answer list.
- [ ] Pass unchanged: the ungraded agreement walk, answer recorded and graded, grading, the grading gate, admin flags projection, and the `/control` grading browsing tests.
