# 01: A team's balance comes from the Coin ledger

**What to build:** Build the Coin ledger module in `shared/types`. From the session's caches (settings, carried coins, coin award totals and the cached purchases) it answers a team's balance: starting coins (only with power-ups on) + carried coins + coin awards − purchase costs, never below 0, and the debt that floor hides. A caller in the middle of a write that holds stored purchases the cache doesn't have yet (just after a purchase, after a live edit's extra joker refund, at a join that just loaded the team's purchases) passes them in explicitly, and they replace the cached purchases for that team only. Every reader of a balance asks the ledger: the admin team view, the coin syncs, the purchase and refund syncs, the join reply and the coin toast. The purchase path's own balance helper is removed, and the five old balance pieces stop being exported. Every balance on every screen stays exactly as it is today. The doc text goes to ticket 03.

Parent spec: `.scratch/coin-ledger/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Table tests at the ledger's interface in `shared/types` cover starting coins only with power-ups on, carried coins with power-ups off, the zero floor and the debt it hides, and passed-in purchases replacing the cached ones for that team only
- [ ] The admin team view, the coin syncs, the purchase and refund syncs, the join reply and the coin toast all get the balance from the ledger
- [ ] The purchase path's balance helper is gone, and the old balance functions are no longer exported; their test cases are moved to the ledger's tests
- [ ] The database-backed coin specs pass, with cases that only re-checked the arithmetic removed
- [ ] `GLOSSARY.md` has a **Coin ledger** entry, linked from **Coin**
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm mutate:changed` (survivors killed or marked) and `pnpm crap:changed` pass
