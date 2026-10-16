# 02: Best and worst rounds

**What to build:** The trends response gains `bestRounds` and `worstRounds`: the top and bottom `TREND_ROUNDS_LIMIT` (5) rounds by average rating across the range, each with session, round title, average and count, counting only rounds with at least `MIN_RATINGS_FOR_RANKING` (3) ratings. The page shows them as two short lists.

Parent spec: `.scratch/feedback-trends/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Real-Postgres test: threshold, ordering, ties (higher count first, then newer session)
- [ ] Page lists and empty state ("Not enough ratings yet")
- [ ] `DOCUMENTATION.md` updated
