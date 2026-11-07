# Spec: One Coin ledger for a team's coins and the coin rules

Status: ready-for-agent

Blocked by: —

## Problem Statement

A team's coins are worked out and guarded in several places that each know part of the rules:

- **The balance math** is five separate exported pieces (income, balance, shortfall, the balance from the session's caches, the sum of purchase costs). Every caller unpacks the session's caches itself. When a bonus award is deleted, the shortfall is assembled entirely by hand from the settings, the carried coin, the new coin award total and the cached purchases. The purchase path has its own balance helper over the stored purchases. That helper is correct, since mid-write the stored purchases are fresher than the cache, but nothing says when each should be used.
- **The coin rules are spread out.** "A balance never hides a debt" (a take larger than the balance is refused; a deleted award whose coins were spent is covered by a new coin award) lives in the bonus award change module. "A quickfire session has no coins" lives there too, through the quickfire rules. "Coins need power-ups on" and "a shot or selfie bonus earns two coins" live in the bonus award module.
- **When coins are shown differs between the two screens.** A phone shows a team's coins when power-ups are on, or when the team holds coins anyway (a carried coin in a session without power-ups). `/control`'s Teams table shows its Coins column only when power-ups are on. So in a session without power-ups the quiz master can't see the carried coins a team can see on its phone and spend in the shop.

A change to how coins work means finding every piece, and the tests check it from five spec files, each from its own side.

## Solution

One **Coin ledger** module in `shared/types` owns what a team's coins are and what may be done with them:

- the team's balance and any debt the zero floor would hide;
- whether a coin award may be given at all, and why not;
- whether a take is refused for being larger than the balance, and the refusal message;
- how many coins a deleted award must cover;
- how many coins a bonus award earns by itself;
- whether coins are shown for a team.

The server's coin writes (bonus awards and their deletion, showdown awards, purchases, joins, syncs) and both screens ask the ledger. The quiz master now sees the Coins column on `/control` whenever a phone would show coins, including carried coins in a session without power-ups. Apart from that, every balance, toast and refusal stays exactly as it is today.

## User Stories

1. As a quiz master, I want to see a team's carried coins in `/control`'s Teams table even when power-ups are off, so that I see what the team sees on its phone.
2. As a quiz master, I want the Coins column hidden when power-ups are off and no team holds any coins, so that the table stays uncluttered on a normal night.
3. As a quiz master, I want a take of more coins than a team has refused whole, with "That team has only N coins to take", so that a balance never hides a debt.
4. As a quiz master, I want a coin award refused in a quickfire session, so that a quickfire night stays without coins.
5. As a quiz master, I want a coin award refused when power-ups are off, as today, so that coins aren't handed out where the night doesn't use them.
6. As a quiz master, I want deleting a shot or selfie award whose coins a team already spent to leave a covering coin award ("Coins already spent when an award was deleted"), so that the team's balance never shows less than it should and never hides a debt.
7. As a quiz master, I want a shot or selfie bonus to give its two coins only with power-ups on and only for positive points, so that a penalty never earns coins.
8. As a team, I want my balance to be the same on every screen (the phone's status screens, the shop, the leaderboard screen, `/control`), so that I trust the number.
9. As a team, I want my balance never to show below zero, so that a deleted award never shows me a negative number.
10. As a team, I want my balance right after a purchase, before anything else happens in the session, so that I can see what I have left at once.
11. As a team, I want my balance right after a live edit refunds an extra joker, so that I see the coins I got back.
12. As a team that joins or rejoins, I want my balance in the join reply, so that a reconnect or a backend restart shows it correctly.
13. As a team holding carried coins in a session without power-ups, I want to keep seeing them and the shop, as today, so that I can spend what I earned for rating every round.
14. As a team in a session with power-ups off and no coins, I want no coins shown, so that my phone doesn't mention something irrelevant.
15. As a team, I want the coin toast to show the coins an award gave and my new balance, as today, so that I know what changed.
16. As a developer, I want a team's balance asked of one module with the session, so that I never pick and unpack the caches myself.
17. As a developer, I want the one case where fresher stored purchases override the session's cache (the middle of a purchase or a refund) to be explicit at the ledger's interface, so that it's clear which source a balance came from.
18. As a developer, I want every coin rule tested as a table through one interface, without a database, so that the tests are fast and mutation testing can see them.
19. As a developer, I want the database-backed coin specs reduced to checking that each write calls the ledger and stores or refuses accordingly, so that they stop repeating rule cases.
20. As a developer, I want "are coins shown" asked of one rule by both `/play` and `/control`, so that the two screens can't disagree again.

## Implementation Decisions

- **New deep module: the Coin ledger**, in `shared/types`, next to the power-up rules. It is pure: it reads the session's caches (settings, quiz mode, carried coins, coin award totals and the cached purchases) and does no I/O.
- **Its interface answers per team:**
  - **Balance and hidden debt:** starting coins (only with power-ups on) + carried coins + coin awards − purchase costs. The balance never goes below zero, and the shortfall is the debt the zero floor hides.
  - **Coin award allowed:** refused in a quickfire session (the existing quickfire message) and when power-ups are off (the existing message). The amount bounds and the points checks stay with the bonus award module, as boundary validation.
  - **Take refusal:** a negative coin award larger than the balance is refused with the existing "That team has only N coin(s) to take".
  - **Debt cover after a deletion:** given the team's coin award total after the deletion, how many coins a covering coin award must give (zero when none).
  - **Coins earned by a bonus award:** two for a shot or selfie bonus with positive points and power-ups on, none otherwise.
  - **Coins shown:** shown when power-ups are on or the team's balance is above zero.
- **The session's caches are the one source.** A caller in the middle of a write that holds stored purchases the cache doesn't have yet (just after a purchase, after a live edit's extra joker refund, at a join that has just loaded the team's purchases) passes those purchases in explicitly. The ledger then uses them for that team in place of the cache. That replaces the purchase path's own balance helper. The cache stays refreshed with the Live results at the end of every session write, as today.
- **The five balance pieces stop being exported.** Their callers (the snapshot's admin team view, the coin syncs, the bonus award change module, the purchase change module, the team roster change module) ask the ledger.
- **The bonus award change module** asks the ledger for "award allowed", the take refusal and the debt cover. It no longer assembles the shortfall itself or calls the quickfire rules for coins.
- **The bonus award module** asks the ledger for the coins a bonus award earns, and still stores the linked and unlinked coin awards as today. The coin part of its award amount check ("coins need power-ups on") moves to the ledger. The quickfire rules module keeps only the settings refusal that the quiz mode work owns.
- **`/control`** shows the Teams table's Coins column when the ledger says coins are shown for any team, with each team's balance. `/play` asks the same rule in place of its own condition, for both the shop and the status screens. Coins stay off for a quickfire session: it has power-ups off, no coin awards, and no league, so no carried coins.
- **No protocol or schema change.** The admin team view already carries each team's coins, and the players' room view and the team's syncs already carry the balance.
- **DOCUMENTATION.md:** the coins section says the Coins column appears whenever coins are shown (power-ups on, or a team holds coins), and names the Coin ledger as where the balance and coin rules live, replacing the name of the old balance function. **GLOSSARY.md** gets a **Coin ledger** entry linked from **Coin**. **`/guide`:** the Teams table's Coins column may now appear on a night without power-ups; one sentence where the guide describes that column.

## Testing Decisions

- **A good test asks the ledger a question through its interface and asserts the answer a quiz master or team would see:** a balance, a refusal message, a cover amount, shown or not. It never asserts which cache was read.
- **The new seam is the Coin ledger's interface**, tested in `shared/types/src/__tests__/` with table tests, per the coding standard that logic in `shared/types` is tested there. It covers:
  - starting coins counted only with power-ups on;
  - carried coins counted with power-ups off;
  - the zero floor, and the shortfall it hides;
  - purchases passed in replacing the cached ones for that team only;
  - the take refusal at, just above and just below the balance, with "1 coin" against "N coins";
  - a coin award refused in a quickfire session and with power-ups off;
  - debt cover of zero, partial and full;
  - shot and selfie coins against custom bonuses, penalties and power-ups off;
  - coins shown in every combination of power-ups and balance.

  Prior art: the existing balance and shortfall cases in the power-ups test file, which move here.
- **Kept: the database-backed specs** (team coins, coin awards, carried coins, the bonus award module, power-up purchase). They check the wiring: a refused take or award stores nothing; a deletion with spent coins stores the covering award; a purchase and a refund sync the right balance before the Live results refresh; a join replies with the balance. Cases that only re-check arithmetic or a rule covered at the ledger seam are deleted.
- **Kept: the page tests**, with views from the fixture builder:
  - `/control` shows the Coins column with power-ups off when a team holds carried coins, and hides it when none does;
  - `/play`'s shop and status screens keep their current behaviour.
- Run `pnpm mutate:changed` and kill or mark the survivors. Run `pnpm crap:changed` before committing.

## Out of Scope

- Power-up purchase rules (the Power-up offer spec). The balance is an input there, which this ledger now supplies.
- The quiz mode's settings refusal (power-ups, starting coins, jokers and leagues in a quickfire session) and the dead per-round quickfire checks (the quiz mode work).
- How carried coins are decided and stored. The carried-coin module keeps deciding them, and the ledger only reads the cached result.
- The bonus award module's eight-parameter award call and its points-only rules (category limits, sign changes on edit).
- Doubled rounds (the doubled-rounds work).

## Further Notes

- Source: candidate 2 of the architecture review on 2026-11-07. The review called this "two sources of truth". On a closer read the cache is refreshed after every session write, so the two sources only differ mid-write. The friction is the scattered rules and the hand-unpacking, plus the `/control` visibility gap. The spec is written to that.
- Independent of the Power-up offer spec. Both edit the purchase change module, so if they run in parallel the second to land rebases over the first. Neither blocks the other.
