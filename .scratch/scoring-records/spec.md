# Spec: Name the Scoring records; one purchase source for the Coin ledger

Status: done

Source: architecture review 2026-11-21, candidate 4 ("Name the Live results cache; one purchase source for the Coin ledger").

## Problem Statement

A live session holds a copy of its stored answers, bonus awards and power-up purchases, re-read with the other **Live results** after every write that touches scores. That copy is named for fun facts (the session's `funFactData` field, the `FunFactData` type and its `FunFact*` row types, the Standings module's `funFactData` read), but about nine modules read it and only one of them builds fun facts: doubled rounds, the leaderboard board, rank callouts, the reveal's teams-correct and power-up counts, the extra-joker rebuild after a live edit, the live edit's doubled-round questions, and the Coin ledger. A developer looking for "the session's purchases" has no reason to look in a field named for trivia.

The Coin ledger itself has two purchase sources. `coinBalance` and `coinDebt` read the cached purchases unless the caller passes an optional `purchases` override, and three callers do: the Team view projection passes rows it has just read from the database, and the purchase change module passes them twice, for the extra-joker and question power-up allowed-checks. The admin snapshot uses the cache. Normally the two agree. When a Live results read fails, the session keeps its earlier cached rows (by design, see **Live results**) while the database has moved on, so the quiz master's control panel and the team's phone show **different coins for the same team** until the next write.

The glossary has drifted too. **Live results** says the session holds "the leaderboard and fun fact data", derived from "answers and bonus awards". The Live results read actually also reads purchases, participants (took part) and departed teams.

## Solution

The cached rows get the domain name **Scoring records**: the session's stored answers, bonus awards and power-up purchases. Every field, type, read and log line that says "fun fact data" for them says Scoring records instead. Fun facts become one of its readers, not its owner.

The Coin ledger reads purchases only from the session's Scoring records. Its optional `purchases` override goes. A write that has fresher purchase rows than the cache puts them in the session's Scoring records before it asks the ledger anything, and a write that stores a purchase also adds it to the Scoring records of the session it returns. That way the session the write stores already holds the purchase, even if the final Live results read fails.

The quiz master and teams see no difference on a normal night. When a Live results read fails, the control panel and the phone now show the same coins for every team.

The glossary's **Live results** entry lists what the read actually reads, and a new **Scoring records** entry says what the cache holds and who reads it.

## User Stories

1. As a quiz master, I want the coins on my control panel to match the coins on each team's phone, so that I can answer "how many coins do we have?" without checking two screens.
2. As a quiz master, I want the coins to still match after a standings read failed, so that a database hiccup doesn't make me give out wrong coin awards.
3. As a quiz master, I want a coin award, a coin take and a covering coin award to work as today, so that fixing coins mid-night still works.
4. As a quiz master, I want a take larger than the team's balance refused with the same message as today, so that I never hide a debt.
5. As a team, I want my coins to drop by the cost as soon as I buy a power-up, so that I know what I have left.
6. As a team, I want a purchase I can't afford refused as today, so that I can't overspend.
7. As a team, I want a power-up I've used up refused as today, so that the max-uses rule holds.
8. As a team, I want buying an extra joker for the next round to be checked against my balance and earlier purchases as today, so that the offer behaves the same.
9. As a team, I want my coins correct right after buying even if the read that follows my purchase fails, so that the phone doesn't show coins I've already spent.
10. As a team, I want my carried coins and starting coins counted as today, so that my balance doesn't change because of a rename.
11. As a team, I want an extra joker that a live edit refunded to give its cost back on both my phone and the control panel, so that the refund is visible everywhere.
12. As a big-screen audience, I want fun facts, rank callouts, the leaderboard board, doubled rounds and the reveal's teams-correct and power-up counts to show exactly what they show today, so that the rename is invisible on stage.
13. As an operator, I want the log line for a failed read to name what failed in domain words ("Scoring records read failed for session …"), so that the log tells me which figure is stale.
14. As a developer, I want the session's answers, bonus awards and purchases under one domain name, so that I find them without knowing they once fed fun facts.
15. As a developer, I want the Coin ledger to take a session and a team and nothing else, so that I can't pass it rows from a different source by mistake.
16. As a developer writing a change that stores a purchase, I want one obvious rule (add it to the session's Scoring records), so that the ledger and every reader see it in the same write.
17. As a developer, I want the glossary's **Live results** entry to list every figure the Live results read reads, so that the docs match the code again.
18. As a developer, I want ADR 0004 (joker doubling is derived, not stored) to stand, so that doubling still comes from jokers and purchases at read time.
19. As a developer, I want the Night brief and other stats reads of an ended session to keep working, so that the rename doesn't break the stats module.

## Implementation Decisions

### The Scoring records

- **Domain name: Scoring records.** They are the session's stored answers (roster teams only, as today), bonus awards and power-up purchases (in purchase order), in the shape the live views read. They are one of the session's **Live results**, re-read with them and kept at their earlier value when the read fails.
- Renames, with no change in shape or content:
  - the session state field `funFactData` → `scoringRecords`;
  - the `FunFactData` type → `ScoringRecords`, and its row types `FunFactAnswer`, `FunFactBonusAward`, `FunFactPowerUp` → `ScoringAnswer`, `ScoringBonusAward`, `ScoringPurchase`;
  - the Standings module's `funFactData` read → `scoringRecords`;
  - the Live results read's label for it ("Fun fact data") → "Scoring records", which changes its failure log line.
- The types stay in shared types. They may move out of the fun-facts module into a module of their own, since fun facts are now one reader among several. The implementer decides, and nothing outside shared types may notice.
- Every reader (fun facts, doubled rounds, the leaderboard board, rank callouts, the session snapshot's reveal counts, the Coin ledger, the live edit's doubled-round questions, the extra-joker rebuild, the stats reads, the frontend room-view test builder) reads the renamed field. No reader changes what it computes.
- The session state is in-memory, server-side. The field isn't part of any client payload, so this is not a protocol change. If an implementer finds it in a payload, that payload's contract must keep its old shape, and they should stop and say so.

### The Coin ledger

- `coinBalance`, `coinDebt` and the internal raw balance lose their optional `purchases` parameter. They read the team's purchases only from the session's Scoring records.
- The ledger's session type narrows its purchase field to `scoringRecords: { purchases: … }`. Only `teamId` and `cost` are read, as today.
- Every other Coin ledger function (`coinTakeRefusal`, `coinDebtCover`, `coinAwardRefusal`, `coinsShown`, `bonusCoinsEarned`) keeps its interface.

### Writes that hold fresher purchase rows

- **Buying a power-up** (question power-up or extra joker): the change still reads the team's stored purchases at the start, because the Power-up offer needs the full rows for its max-uses and per-question checks. It then replaces that team's entries in the session's Scoring records with those rows. The offer's balance comes from `coinBalance(session, teamId)` on that session, with no override. On success it stores the purchase and returns a session whose Scoring records also hold the new purchase. A refused purchase stores nothing and changes no session, as today.
- **The extra-joker rebuild after a live edit** returns a session whose Scoring records hold the rebuilt extra jokers in place of the old ones, and no refunded ones. It keeps reading the pre-edit rows from the started session's cache, as today, because the deleted round rows have already cascaded their purchases away.
- The Team view projection still reads the team's stored purchases for its purchase list, doubled rounds and joker extras, since it needs each purchase's effect. Its coins come from `coinBalance(session, teamId)`, the same call the admin snapshot makes.
- So after any write, both the phone and the control panel take their coins from the stored session's Scoring records. When the final read fails, the purchase list on the phone can include a purchase the cache doesn't have only if that purchase was written outside the two writes above. Nothing does that today. All purchase writes go through the session write.

### Docs

- `GLOSSARY.md`: add **Scoring records**. Rewrite **Live results** to list the leaderboard, the Scoring records, took part and departed teams, all derived from stored answers, bonus awards, purchases and the roster. Change **Coin ledger** if it names the cache. _Avoid_: fun fact data (for the cache).
- `DOCUMENTATION.md`: replace `funFactData` and "fun fact data" wherever they mean the cache (the Live results description, the reveal counts, the fun facts section).
- ADR 0004 stands unchanged: doubling is still derived from jokers and purchases. This change only renames what the derivation reads and narrows where coins come from.
- Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

- Good tests drive the game the way clients do and assert what the phone and the control panel received. They never assert on the field's name, on which source a function read, or on the ledger's parameters.
- **One seam, already in place: the game test suite's gateway handlers with the real Postgres store.** Failure cases spy on the Standings module's read to reject once, as the live results placement spec already does. No new seam.
- New behaviour to pin there:
  - a team buys a power-up while the Scoring records read after that write fails, and the coins in the team's Team view and in the admin snapshot are equal, and both are lower by the cost;
  - the same split check after a coin award that follows a failed read;
  - a live edit that refunds an extra joker, then a failed read, and the phone and the control panel agree on the refunded balance.
- Existing specs that must stay green unchanged except for the rename: the coin, purchase, carried-coin, coin-award, team-coins, wider-margin, award-bonus, teams-correct-count and live-results-placement specs in the game test suite, the Standings service spec, and the shared-types specs for the Coin ledger, fun facts, rank callouts, the leaderboard board and doubled rounds. The live-results-placement spec's expected log line changes to the new label.
- The shared-types Coin ledger spec drops its override cases and keeps the balance, debt, take and cover cases. Those stay pure-function tests, as now.
- Prior art: the live results placement spec (rejecting a Standings read once and asserting the kept value and log line), and the team coins and power-up purchase specs (coins seen by the phone and the admin).

## Out of Scope

- Making the Team view's purchase list come from the cache. It needs each purchase's effect, which the Scoring records don't carry.
- Adding effect or any new column to the Scoring records.
- Changing when the Live results read runs or what it does on failure.
- Renaming the other Live results (leaderboard, took part, departed teams), or grouping them under one session field.
- Any change to how doubling is derived (ADR 0004).
- Candidates 1–3, 5 and 6 of the same architecture review.

## Further Notes

- The coin split only shows when a Live results read fails. It's rare, but it's the case the **Live results** rule exists for, and a coin mismatch is exactly what makes a quiz master give out wrong coin awards.
- Run `pnpm crap:changed` before committing. The purchase change module's functions are touched, and the CRAP rule covers every function in a touched file.
