# Spec: One Power-up offer module for the server and the phone

Status: ready-for-agent

Blocked by: —

## Problem Statement

A team's phone and the server each decide separately whether a power-up can be bought right now, and nothing keeps their answers the same.

- The server asks two shared refusal rules: one for question power-ups and one for the extra joker. Both are shallow. Each takes about as many inputs as it has checks, and the server's single caller works out every input by hand: it counts the team's uses of the power-up, checks whether the team already used it on this question, lists the rounds the team already doubles (its joker round plus earlier extra jokers), and excludes a quickfire round.
- The phone's power-ups list never calls those rules. It repeats them in its own words: uses against the limit, one use per question, an extra joker not on the joker round or on an already-doubled round, coins against the cost. The quickfire round exclusion is in a third place, the play page.

So a rule change has to be made in three places, and if one is missed the phone shows an Activate button the server then refuses, or hides a power-up the server would sell. The same refusal cases are tested from three sides (shared rules, database-backed purchase specs, phone tests), and none of them checks that the phone and the server agree.

## Solution

One **Power-up offer** module in `shared/types` answers "what can this team buy right now, and if not, why not?" Both ends call it:

- **The server** builds the offer from the purchases it loads and the session, and refuses a buy with the offer's reason, worded exactly as today.
- **The phone** builds the offer from its own synced purchases, its coins and the players' room view, and renders it: a card with its target when the power-up can be used now, the reason on a disabled button when the only thing stopping it is the coins or Ask the room's readiness, and a plain "Not available now" row otherwise.

A team sees the same thing as today. The difference is that the phone's buttons and the server's refusals now come from one place.

## User Stories

1. As a team, I want the Activate button to appear only for a power-up the server will sell me now, so that pressing it doesn't end in an error toast.
2. As a team, I want a power-up I can't use right now listed under "Not available now", so that I still know it exists and what it costs.
3. As a team, I want a disabled "Not enough coins" button when coins are the only thing stopping a purchase, so that I know saving up will unlock it.
4. As a team, I want a disabled "Waiting for more answers" button on Ask the room until enough other teams have answered, so that I know to try again shortly.
5. As a team, I want a question power-up offered only while the question can still be answered, so that I never spend coins on a locked question.
6. As a team, I want a question power-up offered only on a question it works on (a 50/50 only with more than two options, first letter only on free text, …), so that I can't buy something useless.
7. As a team, I want each question power-up offered once per question, so that I can't pay twice for the same help.
8. As a team, I want a power-up to drop out of "Available now" once I reach the session's limit for it, so that the list shows what's actually left.
9. As a team, I want a power-up the quiz master didn't offer this session left out of the list, so that I'm not tempted by something I can't have.
10. As a team, I want the extra joker offered only for the next round, before its intro, so that I double a round whose topic I could judge.
11. As a team, I want the extra joker not offered on my joker round, so that I don't pay to double a round that's already doubled.
12. As a team, I want the extra joker not offered on a round I already doubled with an earlier extra joker, so that I don't waste coins.
13. As a team, I want the extra joker card to name the next round by its title when the round overview showed it, and by "Round N" otherwise, so that I never learn a topic I wasn't shown.
14. As a team, I want no question power-ups offered in a quickfire round, since a tap locks my pick and nothing can help, so that I don't spend coins for nothing.
15. As a team, I want the server's refusal reason, worded for me, whenever a purchase is refused anyway (two phones on one team racing, a lock landing mid-press), so that I know what happened.
16. As a team, I want the refusal wording unchanged ("Answers are locked for this question", "That power-up does not work on this question", "That power-up is not offered", "You have reached the limit for that power-up", "You already used that power-up on this question", "Not enough coins", "Only the next round can be doubled, before its intro", "That round is already doubled", "Waiting for more answers"), so that nothing I've learned changes.
17. As a team that reconnects, I want my power-ups list to come back exactly as before the drop, so that a phone that slept loses nothing.
18. As a team with two phones, I want both phones to show the same offer after either one buys, so that we don't buy twice.
19. As a quiz master, I want the limits, costs and offered power-ups I set to be enforced the same on every phone and on the server, so that the shop works as I configured it.
20. As a quiz master, I want a refused purchase to store nothing and leave every coin balance alone, so that I never have to fix a balance by hand.
21. As a developer, I want each power-up rule written once, so that a new rule or a new power-up is one change in one module.
22. As a developer, I want to test every rule as a table through one interface, without a database or a rendered page, so that the tests are fast and mutation testing can see them.
23. As a developer, I want the server's purchase specs to check only the wiring (refused buys store nothing, accepted buys store and sync), so that they stop repeating rule cases.
24. As a developer, I want the phone's tests to check only that the phone renders what the module returns, so that a rule change doesn't break page tests for unrelated reasons.
25. As a developer, I want the play page's power-ups wiring reduced to passing the view and the team's data through, so that the page stops working out the quickfire case itself.

## Implementation Decisions

- **New deep module: the Power-up offer**, in `shared/types`, next to the existing power-up rules. It takes everything as plain data and does no I/O:
  - the session's power-up settings (cost and limit per power-up);
  - the team's own purchases, as the shape the server's purchase records and the phone's purchase views share (power-up, question id, round id);
  - the team's coin balance;
  - the question the purchase is for, or none when nothing can be answered (with whether it can be answered now and whether its round is a quickfire round);
  - whether Ask the room is ready on that question;
  - the extra joker's offered round (what the existing next-round rule says, with its visible title) and the team's joker round.
- **What it returns:** one entry per power-up the session offers (limit above 0), in the existing power-up order, carrying the power-up's cost, its limit, the team's uses, and one of three outcomes:
  - can be bought now, with its target (this question, or the next round and its shown name);
  - held back only by coins or Ask the room's readiness, with the target and the reason;
  - not available now, with the reason.
- **One refusal question for the server:** the module also answers "why is this exact buy refused?" for a requested question id or round id. A request for anything other than the offered question or round gets the existing wording ("Answers are locked for this question" / "Only the next round can be doubled, before its intro").
- **Precedence and wording stay as the server has them today**, including the extra joker's order (not offered → not the next round → already doubled → limit → coins). Ask the room's readiness is checked last, after coins, as the server does today. The one visible change on the phone: a team that is short of coins **and** waiting on Ask the room now sees "Not enough coins" rather than "Waiting for more answers".
- **The two current refusal rules are folded into the module and stop being exported.** Their only production caller is the purchase change module. The next-round rule (which round the extra joker is for) and the "does this power-up work on this question type" rule stay separate as they are and are called by the module. The room views still use the next-round rule to build the extra joker offer.
- **The purchase change module keeps** loading the purchases, working out the balance, finding the answerable question, computing Ask the room's readiness from the other teams' answers, drawing the purchase's effect, storing it and syncing it to the team's phones. It no longer counts uses, lists doubled rounds or checks for a quickfire round itself. Ask the room's readiness is passed in. The effect step still refuses with "Waiting for more answers" if the split can't be built.
- **The phone's power-ups list** drops its own rows, target and extra joker target logic and renders the module's entries. The play page stops working out the quickfire round case. It passes the answering question (or none) with its quickfire flag, and the module decides.
- **The quickfire round check moves into the module unchanged.** Under ADR 0005 it can no longer fire (a quickfire quiz has power-ups off), but removing it belongs to the quiz mode work, not here.
- **Balance stays an input.** The server keeps its database-backed balance and the phone keeps its synced coins. Giving both one source is the separate Coin ledger work.
- **No protocol change.** The phone already gets every input: settings and the extra joker offer in the players' room view, purchases and coins in the team's purchase sync, Ask the room readiness in the team's room-ready sync. Nothing new is sent and the reconnect path is unchanged.
- **Coding standards:** the standard says clients do no game logic, and the phone already re-derives these rules. Calling the shared module instead keeps it to the same derivation from data it was sent, in one place. Moving the offer into a per-team server push was considered and left out: the offer changes on every move and would need a per-team view on every broadcast.
- **GLOSSARY.md** gets a **Power-up offer** entry (what a team can buy right now and why not, answered by one module for both the phone and the server), linked from **Power-up**. Behaviour doesn't change, so DOCUMENTATION.md and `/guide` don't change. The one wording precedence change above is too small for the guide.

## Testing Decisions

- **A good test goes through the module's interface and asserts what a team would see or be told:** the entries, their outcomes, targets and reasons. It never asserts how a count or a doubled-round list was built.
- **The new seam is the Power-up offer module's interface**, tested in `shared/types/src/__tests__/` with table tests, per the coding standard that logic in `shared/types` is tested there. It covers every refusal reason for question power-ups and for the extra joker, their precedence, the coins/waiting outcomes, the quickfire round, a session with nothing offered, the limit counting only that power-up's uses, one use per question, the joker round and earlier extra jokers both blocking a round, the title against "Round N" naming, and a request for a question or round other than the offered one. Prior art: the existing refusal cases in the power-ups test file, which move here and are rewritten against the new interface. Run `pnpm mutate:changed` and kill or mark the survivors.
- **Kept: the backend's database-backed purchase specs** (power-up purchase, extra joker, extra joker live edit, wider margin purchase, pin one). They check the wiring: a refused buy stores nothing and changes no balance, and an accepted buy stores, charges and syncs to the team's phones. Add one spec where two phones of one team race for the last use, and only one buy goes through. No test covers that race today. Cases there that only re-check a rule already covered at the module seam are deleted.
- **Kept: the phone's power-ups tests**, with views from the fixture builder. They check rendering: an available card with its target, the disabled button with the module's reason, the "Not available now" rows, nothing in a quickfire round, and the extra joker card's name. Rule cases that duplicate the module's tests are cut down to one per outcome kind.
- No new e2e journey. The existing power-up journeys (`pnpm e2e`) should pass unchanged and are run once before the work is called done.
- `pnpm crap:changed` is run before committing, per the project guide.

## Out of Scope

- Removing the per-round quickfire check from the purchase path, the extra joker's next-round rule and the live-edit refund (the quiz mode work, candidate 4 of the 2026-11-07 architecture review).
- A single source for a team's coin balance, and coin visibility on `/control` against `/play` (the Coin ledger work, candidate 2).
- The doubled-rounds derivation in standings, the ended-session reads, the leaderboard board and fun facts (candidate 3). Only the purchase path's own version moves into the module.
- The rest of the play page's helper split (candidate 5).
- Power-up effects (50/50 draw, text hints, Ask the room split, pin one, wider margin regrade) and the live-edit refund of extra jokers: unchanged.
- The wrong extra joker price in the power-ups settings form's doc comment ("4 / 3" where the default is 6 / 5). It's a one-line fix to make on its own.

## Further Notes

- Source: candidate 1 of the architecture review on 2026-11-07, chosen as the top recommendation because `shared/types/src/power-ups.ts` is the repo's most-changed file and the phone and server copies can drift.
- The next-round rule already lives in `shared/types` and feeds the players' room view. The module reuses it rather than duplicating it.
