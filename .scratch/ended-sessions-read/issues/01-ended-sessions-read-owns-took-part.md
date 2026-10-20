# 01: Ended-sessions read owns "took part"; Standings reads participants from it

**What to build:** A new backend module, the **Ended-sessions read**, sits beside the Standings module and holds the one definition of **took part**: a team took part in a session if it is on the roster now, or has an answer or bonus award stored for it (kicking or leaving deletes the roster row but keeps those). This read ignores session status, because the Standings module also uses it for live sessions.

The Standings module stops defining participants itself. Its leaderboard, its "has taken part" check and its session totals query all read participants from the new module. Nothing changes for users: every leaderboard, standings table, participant count and team-night check comes out exactly as before.

This is the prefactor that the later tickets build on. See the spec's "The Ended-sessions read module" and "Readers → Standings".

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The Ended-sessions read is a Nest provider over Knex, beside the Standings module. Its participants read takes a set of session ids or a set of team ids and returns session id, team id and whether the team is on the roster.
- [ ] The participants read includes teams in lobby and running sessions (it ignores status).
- [ ] The Standings module's own participants subquery is deleted. Its standings, "has taken part" check and session totals query use the new read.
- [ ] A new real-Postgres spec for the Ended-sessions read, using the per-worker cloned test database, covers:
  - a roster team that answered nothing took part;
  - a kicked team with answers took part;
  - a departed team with only a bonus award took part;
  - a team kicked before leaving any mark did not take part;
  - a team in a running session is returned.
- [ ] Standings service spec cases that only exercised the participation rule move to the new spec. Its loading and ranking cases still pass unchanged.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass.
