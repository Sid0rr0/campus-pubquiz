# 02: One SQL form for history reads, pinned by a parity test

**What to build:** The standings and the ended-sessions read get their doubled rounds from one SQL fragment that states the same rule as ticket 01's module. Standings totals, round points, the league table, the scoresheet's doubled cells, the session detail and the team history all stay exactly as they are; a parity test now guarantees the SQL and the in-memory rule can't drift apart.

Parent spec: `.scratch/doubled-rounds/spec.md`

**Blocked by:** 01 (Doubled rounds module)

**Status:** done

- [ ] The standings module exports one query fragment giving doubled rounds as rows of session id, team id and round id: the union of the session jokers and extra-joker purchases with a round, without duplicates.
- [ ] The round-points query joins answers to the fragment on session, team and the answer's question's round and applies the joker multiplier when it matches, replacing the joker left join and the extra-joker `not exists` subquery. A round that is both a joker round and an extra-joker round counts double, not quadruple.
- [ ] The ended-sessions read's doubled-rounds method selects from the fragment (narrowed by sessions and optionally one team) instead of concatenating two queries.
- [ ] A DB-backed parity spec seeds the module's table cases (including joker and extra joker on one round, and a team with neither) into jokers and purchases, reads doubled rounds through the fragment and through ticket 01's module from the same rows, and asserts the sets are equal.
- [ ] The existing standings, session-result and ended-sessions-read specs pass unchanged.
- [ ] `pnpm crap:changed` passes.
