# 02: Coin award rules come from the Coin ledger

**What to build:** The Coin ledger gains the coin award rules:
- whether a coin award may be given at all: refused in a quickfire session and with power-ups off, each with its existing message;
- whether a take is larger than the balance: refused whole with "That team has only N coin(s) to take";
- how many coins a covering coin award must give when a deleted award's coins were already spent;
- how many coins a bonus award earns by itself: two for a shot or selfie bonus with positive points and power-ups on, none otherwise.

The bonus award change module asks the ledger for these and no longer assembles the shortfall itself or calls the quickfire rules for coins. The bonus award module asks it for the earned coins and the "coins need power-ups on" rule, and keeps its amount bounds and points checks. The quickfire rules module keeps only the settings refusal. Every refusal, covering coin award and toast stays as it is today. The doc text goes to ticket 03.

Parent spec: `.scratch/coin-ledger/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Table tests at the ledger's interface cover a coin award refused in a quickfire session and with power-ups off, the take refusal at, just above and just below the balance ("1 coin" against "N coins"), debt cover of zero, partial and full, and shot and selfie coins against custom bonuses, penalties and power-ups off
- [ ] The bonus award change module and the bonus award module ask the ledger for every coin rule; no shortfall is assembled by hand, and the quickfire coin check is no longer in the change module
- [ ] A refused take or award stores nothing; a deletion with spent coins stores the covering award ("Coins already spent when an award was deleted"); the database-backed specs check this wiring, with cases that only re-checked a rule removed
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm mutate:changed` (survivors killed or marked) and `pnpm crap:changed` pass
