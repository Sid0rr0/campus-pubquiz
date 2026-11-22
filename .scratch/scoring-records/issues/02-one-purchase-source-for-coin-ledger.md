# 02: One purchase source for the Coin ledger

**What to build:** The control panel and each team's phone show the same coins for every team, even when the Live results read after a write fails.

- The Coin ledger reads purchases only from the session's Scoring records. Its optional purchases override is removed.
- Buying a power-up (question power-up or extra joker) still reads the team's stored purchases for the Power-up offer. It then puts those rows into the session's Scoring records before checking the balance. On success it adds the new purchase there as well.
- The Team view takes its coins from the same call the admin snapshot makes. Its purchase list still comes from the stored rows, because it needs each purchase's effect.
- The extra-joker rebuild after a live edit returns a session whose Scoring records hold the rebuilt extra jokers, and not the refunded ones.

See the spec's "The Coin ledger" and "Writes that hold fresher purchase rows".

**Blocked by:** 01 (Rename the cache to Scoring records).

**Status:** done

- [ ] `coinBalance` and `coinDebt` take only a session and a team; no caller passes purchases
- [ ] A team buys a power-up and the read after that write fails: the coins in its Team view and in the admin snapshot are equal and both are lower by the cost
- [ ] A coin award follows a failed read: the phone and the control panel show the same balance
- [ ] A live edit refunds an extra joker, then the read fails: the phone and the control panel agree on the refunded balance
- [ ] Unaffordable and used-up purchases are refused with today's messages
- [ ] The new cases run through the game test suite's gateway handlers with real Postgres. The read is made to fail by having the Standings read reject once, as the live results placement spec does
- [ ] The shared-types Coin ledger spec drops its override cases and keeps the balance, debt, take and cover cases
- [ ] `GLOSSARY.md` **Coin ledger** says the purchases come from the Scoring records, if it names a source
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
