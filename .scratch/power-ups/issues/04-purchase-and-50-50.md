# 04: Buying a question power-up: 50/50

**What to build:** the purchase flow end to end, with 50/50 as the first power-up.

- New stored purchase (team, session, power-up, question or round, stored effect). One socket event to buy, validated with Zod. Refused when: not offered, limit used, already used on this question, balance too low, or the question can't be answered.
- 50/50: leaves ⌊n/2⌋ options, at least 2, with the correct one kept. Not offered with 2 options. The removed options are drawn once (RandomSource) and stored.
- Phone: power-up bar under the question, showing only power-ups that apply to its type. Removed options are hidden after a reconnect too.
- /control: which power-ups each answer used.
- Big screen reveal view: the power-up count per question when non-zero, no team names.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Leave-count rule in shared types with unit tests
- [ ] Purchase service, real-Postgres spec for every refusal
- [ ] Phone bar, admin answer list, display reveal, Vitest
- [ ] `CLAUDE.md` Known Tradeoffs: a key fix after a power-up refunds nothing; the quiz master gives the coin back with a coin award
- [ ] `DOCUMENTATION.md` power-ups section, `/guide` page
