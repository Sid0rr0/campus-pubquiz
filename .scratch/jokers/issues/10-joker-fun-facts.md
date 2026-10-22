# 10: Joker fun facts

**What to build:** In sessions played with jokers, the break's fun facts gain five joker facts, after the existing facts and before `bonus_awards_so_far`: the favourite joker round and how many teams bet on it, a round nobody bet on, how many teams got a drawn joker, the best joker (most extra points) and a joker that backfired (the team's lowest-scoring round so far). The first three name no team and can appear from the first break. The last two name a team and only use joker rounds already revealed.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] `describeFunFacts` kinds `joker_favourite_round`, `joker_snubbed_round`, `joker_drawn_count`, `best_joker`, `joker_backfired`, in that order before `bonus_awards_so_far`; each skipped when it has no data
- [ ] Team-naming facts read only revealed joker rounds; ties go to leaderboard name order; extra points come from the shared doubling step
- [ ] None appear when Jokers is off; all go with the existing fun-facts switch
- [ ] `/display` words each fact
- [ ] Pure module specs (including secrecy before reveal), a real-store harness spec, page specs
- [ ] `DOCUMENTATION.md` fun facts table updated
