# 03: Kill the two real mutation survivors in the Power-up offer and Doubled rounds modules

**What to build:** Two tests that fail today when the code is wrong, found by `pnpm mutate:changed origin/main` on PR #94.

- `shared/types/src/power-up-offer.ts` (the "already used on this question" check): a purchase of a _different_ power-up on the same question must not block this power-up. Mutating `p.powerUp === powerUp` to `true` survives.
- `shared/types/src/doubled-rounds.ts` (`doubledRoundIdsOfTeam`): a team with no joker entry returns only its extra-joker rounds. Mutating `jokers[teamId]?.roundId` to `jokers[teamId].roundId` survives.

Not gaps (triaged): `purchase-changes.ts` NoCoverage survivors are unreachable defences (`'Question missing'`, the effect step's "Waiting for more answers" now that readiness is checked first, the `[]` defaults, the no-effect error); the two `power-ups.ts` NoCoverage survivors are in `power-ups.ts` code this spec didn't change.

Parent spec: `.scratch/power-up-offer/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A table case in `power-up-offer.test.ts`: another power-up bought on this question does not block this one
- [ ] A case in `doubled-rounds.test.ts`: a team with no joker entry
- [ ] `pnpm mutate:changed` shows both mutants killed
