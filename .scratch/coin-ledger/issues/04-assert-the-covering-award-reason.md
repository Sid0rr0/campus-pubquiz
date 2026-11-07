# 04: Assert the covering coin award's reason

**What to build:** Mutation testing of the Coin ledger work left one real survivor: `apps/backend/src/game/state/bonus-awards-changes.ts:133`, the covering coin award's reason `'Coins already spent when an award was deleted'` → `""`. The existing deletion-with-spent-coins spec checks the covering amount but not the reason stored on the award. Assert the reason in that database-backed spec.

Other survivors from `pnpm mutate:changed origin/main` are equivalent (`coin-ledger.ts:89`, a take of 0 refuses nothing either way) or sit in code this spec didn't change.

Parent spec: `.scratch/coin-ledger/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The deletion-with-spent-coins spec asserts the covering award's reason text
- [ ] `pnpm --filter backend mutate:db` shows the `:133` mutant killed
