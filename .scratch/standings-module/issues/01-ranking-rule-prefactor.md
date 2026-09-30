# 01: Ranking rule prefactor

**What to build:** A pure ranking rule in shared types that owns:
- the ordering: total (quiz points + bonus points) descending, then team name, compared the same way regardless of locale
- competition ranks: each team gets a 1-based `rank` and the last place its tie group spans (`rankTo`, equal to `rank` when not tied), so the team after a three-way tie for second is 5th
- the single winner: the first team in order, or none when there are no teams; an unbroken tie for first falls back to name order

The shared leaderboard helpers are rewritten on top of it: the reveal step count (one step per tie group), the tied-for-first lookup that seats a showdown, and the kahoot top-5 cutoff (which still splits a tie at the cutoff).

This is behaviour-preserving for live play. Nothing new is sent to clients yet. See [spec](../spec.md).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Table-driven tests on the ranking rule cover:
  - no teams and a single team
  - every team tied, including everyone on zero
  - a tie for first, a three-way tie in the middle, and a tie at the bottom
  - negative totals from penalties
  - names differing only in case, accents or digits, ordered identically whatever the runtime locale
  - the winner when first place is clear, and the name-order fallback when it's tied
- [x] The reveal step count, tied-for-first lookup and kahoot top-N cutoff use the ranking rule. None of them scans for equal totals on its own any more.
- [x] All existing reveal, showdown and kahoot leaderboard tests pass unchanged.

## Comments

Implemented in the commit titled `feat(shared-types): add ranking rule under the leaderboard helpers` (hash in git history). New `shared/types/src/ranking-rule.ts` (`rankTeams`, `getWinner`, `compareTeamNames`, code-unit name order). `getLeaderboardRevealStepCount` and `getTiedForFirst` now read its ranks; the kahoot cutoff still slices the ranked list so it splits a tie. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
