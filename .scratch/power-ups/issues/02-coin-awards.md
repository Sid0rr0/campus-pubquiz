# 02: Coin awards

**What to build:** coins from shots, selfies and the quiz master.

- New stored coin award (team, session, coins, optional reason, optional link to a bonus award).
- A shot or selfie bonus award in a session with power-ups on creates a linked +1 coin award. Deleting the bonus award deletes it. Editing points doesn't touch it.
- Bonus award form: a coins field kept separate from points. It can be used alone (0 points) and can be negative. Hidden when power-ups are off.
- The team's own coin awards are kept current on its phone with a toast, like bonus awards.
- The balance never shows below 0, even when an award removed later had already been spent.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Entity + migration, real-Postgres spec for the linked create/delete
- [ ] Admin endpoints with Zod bodies, payload types in shared types
- [ ] Form field and phone toast, Vitest
- [ ] `DOCUMENTATION.md` bonus section, `/guide` tip
