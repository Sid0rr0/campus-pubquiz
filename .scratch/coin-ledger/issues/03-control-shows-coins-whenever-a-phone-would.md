# 03: /control shows coins whenever a phone would

**What to build:** The Coin ledger gains "coins shown": a team's coins are shown when power-ups are on or its balance is above 0. `/play` asks it for the shop and the status screens instead of its own condition. `/control`'s Teams table shows the Coins column when the ledger says coins are shown for any team. So in a session without power-ups, the quiz master sees the carried coins a team sees on its phone, and on a normal night without power-ups and without coins the column stays hidden. A quickfire session never shows coins. The spec's doc text all lands here:
- the `DOCUMENTATION.md` coins section says when the Coins column appears, and names the Coin ledger in place of the old balance function;
- `/guide` gets one sentence where it describes the Coins column, within the guide's word cap.

Parent spec: `.scratch/coin-ledger/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Table tests at the ledger's interface cover coins shown in every combination of power-ups on/off and balance zero/above zero
- [ ] `/play`'s shop and status screens use the ledger's rule and behave as today
- [ ] `/control` shows the Coins column with power-ups off when a team holds carried coins, and hides it when none does (page tests with views from the fixture builder)
- [ ] `DOCUMENTATION.md` and `/guide` are updated as above; the guide word-cap test passes
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm mutate:changed` (survivors killed or marked) and `pnpm crap:changed` pass
