# Spec: one Doubled rounds module for the Joker and the Extra joker

Status: ready-for-agent

Source: architecture review 2026-11-07, candidate 3 ("One 'doubled rounds' module for the Joker and Extra joker").

## Problem Statement

ADR 0004 put the step that doubles points (the joker multiplier) in one shared place, but not the question that feeds it: which rounds does this team double? Seven places answer that question, each in its own way:

- the standings' round-points SQL (a join on `session_team_jokers` plus a `not exists` subquery on extra-joker purchases)
- the ended-sessions read's "doubled rounds" union (two queries concatenated), which marks the joker cells on the scoresheet, session detail and team history
- the big screen's leaderboard board, which picks the teams to badge with a joker for the block in play
- the fun facts' joker holders
- the extra-joker purchase refusal ("That round is already doubled"), which builds its list from the team's purchase rows
- the phone's doubled-rounds list (joker round plus purchases with a round), which drives the round marks, the question picker and the "+N" joker extra on a revealed answer
- the phone's power-ups list, which hides the extra-joker buy button when the offered round is already the joker round or already bought

For the quiz master and the teams this works today, but only because all seven copies happen to agree. A change to what doubles a round (a new doubling source, a rule like "a deleted round's extra joker no longer counts") needs seven edits in two apps and SQL. Miss one and the copies disagree on stage: the big screen shows a joker badge the standings didn't double, the phone shows a buy button the server refuses, or the scoresheet marks a cell double that the total didn't count double.

## Solution

One **Doubled rounds** module answers "which rounds does this team double in this session" once: a round is doubled when it is the team's joker round or a round the team bought an extra joker for. It answers in two forms that state the same rule:

- **in memory**, for everything that already has the session or the team's purchases in hand: the leaderboard board, fun facts, the extra-joker refusal and both phone sites
- **as one SQL fragment**, for history reads that sum or mark points straight from the database: the standings' round points and the ended-sessions doubled-rounds read

A parity test seeds the same jokers and purchases into the database and into memory and checks the two forms agree, so the SQL can't drift from the in-memory rule.

Nothing changes for the quiz master, the teams or the big screen. Points, marks, badges, fun facts and refusals stay exactly as they are; the change is that the rule now lives in one place. Doubling stays derived when points are summed (ADR 0004); this gives its input a single home.

## User Stories

1. As a team, I want my joker round counted double in the standings, so that the joker I played pays off.
2. As a team, I want a round I bought an extra joker for counted double in the standings, so that the coins I spent pay off.
3. As a team, I want a round that is both my joker round and an extra-joker round counted double, never quadruple, so that the score matches the rules I was told.
4. As a team, I want my phone's round marks to show exactly the rounds the standings double, so that I'm not misled about where my double points are.
5. As a team, I want my phone's "+N" joker extra on a revealed answer to appear only on rounds that the standings actually double, so that the number on my phone matches the board.
6. As a team, I want the question picker on my phone to mark the same doubled rounds, so that I can see at a glance which questions are worth double.
7. As a team, I want the extra-joker buy button hidden when the offered round is already doubled for me, so that I don't try to buy something the server will refuse.
8. As a team, I want the server to refuse an extra joker on a round I already double with the same rule my phone used, so that the phone and the server never disagree.
9. As a team, I want the server to refuse a second extra joker on the same round, so that I don't waste coins on a round already doubled.
10. As a team that bought an extra joker blind (round overview off), I want that round treated as doubled everywhere once bought, so that the blind purchase counts the same as a named one.
11. As a quiz master, I want the big screen's joker badges on the leaderboard to mark exactly the teams that double a round of the block in play, so that the audience sees why a team jumped.
12. As a quiz master, I want a team that doubles a block's round through an extra joker badged the same as one that doubles it through its joker, so that both sources show up on the board.
13. As a quiz master, I want a team holding no joker and no extra joker on the block's rounds left unbadged, so that badges mean something.
14. As a quiz master, I want the fun facts about jokers (how many teams played a joker on a round, how a joker paid off) to count the same holders the standings double, so that a fun fact never contradicts the board.
15. As a quiz master, I want fun facts to leave out teams that left the roster, so that the facts only mention teams still playing.
16. As a quiz master, I want fun facts to leave out a joker or extra joker on a round that no longer exists in the quiz, so that a deleted round doesn't produce a fact about nothing.
17. As a quiz master, I want changing a team's joker round to move its doubling everywhere at once (standings, marks, badges, fun facts, phone), so that a correction doesn't leave stale double points anywhere.
18. As a quiz master, I want a reopened joker pick that clears a drawn joker to stop doubling that round everywhere, so that the reopen behaves the same on every screen.
19. As a quiz master reviewing an ended session, I want the scoresheet's doubled cells to be exactly the rounds the session's totals doubled, so that the cells add up to the total.
20. As a quiz master reviewing a team's history, I want each past session's doubled rounds marked from the same rule as its totals, so that old nights read consistently.
21. As a quiz master, I want the league table's points to double the same rounds as the session's standings, so that league totals match the nights they're built from.
22. As a team on the team page, I want my past nights' doubled rounds marked the same way they were scored, so that my history makes sense.
23. As a developer adding a new way to double a round, I want to change one module and have every screen, total and refusal follow, so that I can't forget a site.
24. As a developer, I want the in-memory and SQL forms of the rule pinned to each other by a test, so that a change to one that isn't made to the other fails the build.
25. As a developer, I want the doubled-rounds rule tested through its own small interface with table cases, so that I don't need a database or a rendered phone to test the rule.
26. As a developer reading the standings query, I want the doubling condition to read as "this answer's round is doubled for this team" instead of a hand-written join and subquery, so that the query says what it means.
27. As a developer, I want the term "doubled round" defined in the glossary, so that the code, the docs and the conversation all use one word for "a round that counts double for a team, from either source".

## Implementation Decisions

- **New domain term: Doubled round.** A round that counts double for a team in a session: its joker round, or a round it bought an extra joker for. No round counts more than double. Add it to the glossary under Jokers (or Power-ups), and change the Joker round entry's "Avoid: double round, doubled round" so "doubled round" points to the new term rather than being banned outright: a joker round is one kind of doubled round, not a synonym for it.
- **The in-memory module lives in shared types**, beside the joker module, so the backend and the phone import the same function. Its interface is small and takes plain inputs, not the whole session:
  - inputs: the team's joker round id (or none), and the team's purchases as rows with a power-up id and a round id (null for question power-ups and blind purchases with no round)
  - output: the team's doubled round ids, without duplicates
  - a session-level convenience that reads the joker from the session's jokers and the purchases from the session's purchase list for one team, used by the leaderboard board and fun facts
  - It takes no stance on which purchase list is the true one. The server today feeds it purchase rows from the database in the purchase step and the fun-fact purchase cache elsewhere; choosing a single purchase source is candidate 2 (the Coin ledger), not this spec.
- **The phone works in round numbers, the server in round ids.** The module answers in round ids. The phone already gets a round id on each purchase and knows its joker round's id; it maps the module's ids to round number and title at the edge, keeping its current display (sorted in quiz order, "" title for a blind purchase).
- **Callers to move onto the in-memory module:**
  - leaderboard board: the joker-badge filter asks "does this team double any round of the block in play"
  - fun facts: joker holders are built from the module's doubled rounds per roster team, keeping the "round must exist" and "on the roster" filters and the joker's source (chosen / drawn / set by the quiz master / extra) that the facts use
  - extra-joker purchase step: passes the module's answer as the refusal's "already doubled" input instead of building it from the purchase rows by hand
  - phone doubled-rounds list and the power-ups list's extra-joker target: both ask the module whether the offered round is already doubled
- **The SQL form is one exported query fragment in the backend**, owned by the standings module (it already owns "the one step that adds up answer points"). It produces the doubled rounds as rows of session id, team id and round id: the union of the session jokers table and extra-joker purchases with a round, with duplicates removed.
  - The standings' round-points query joins answers to that fragment on session, team and the answer's question's round, and multiplies by the joker multiplier when the join matches. This replaces both the joker left join and the extra-joker `not exists` subquery. Because duplicates are removed, a round that is both a joker round and an extra-joker round still matches once and counts double, not quadruple.
  - The ended-sessions read's doubled-rounds method selects from the same fragment (narrowed by sessions and optionally one team) instead of running two queries and concatenating them.
- **No quickfire check in the module.** Under ADR 0005 a quickfire quiz has no jokers and no power-ups, so no quickfire round can be doubled; the module needs no gate. Removing the dead per-round quickfire gates elsewhere belongs to candidate 4 (Quiz mode).
- **ADR 0004 stands.** Doubling stays derived at sum time; stored answer points are untouched; the multiplier step stays where it is. No schema change, no migration, no protocol change.

## Testing Decisions

- **A good test here checks the answer, not the plumbing:** given these jokers and purchases, these rounds are doubled; given this seeded session, these totals and these marks. No test asserts how a caller builds its inputs or which helper it calls.
- **The rule's own surface (shared types, Vitest):** a table test on the in-memory module covering: no joker and no purchases; joker only; extra joker only; joker and extra joker on different rounds; joker and extra joker on the same round (listed once); several extra jokers; question power-ups ignored; an extra joker with no round ignored. Prior art: the joker and power-ups tests in the shared types tests folder.
- **Parity test (backend, Jest, DB-backed):** seed sessions with the cases above (including the joker-plus-extra-joker-on-one-round case and a team with neither) into the jokers and purchases tables, read doubled rounds through the SQL fragment, build the in-memory answer from the same rows, and assert the two sets are equal. This is the test that pins the SQL to the rule. Prior art: the standings service spec and the ended-sessions read spec with their test utils.
- **Existing behaviour specs stay and must pass unchanged:** standings (round points double the joker round and an extra-joker round, never quadruple), ended-sessions read (doubled rounds per team), leaderboard board (joker badges), fun facts (joker holders), the extra-joker refusal cases, the phone's joker-round helpers, and the e2e power-ups journey. These are the regression net for the callers; once they pass on the new module, caller-level duplicates of the rule's cases can be trimmed to one wiring check each.
- **Run `pnpm crap:changed`** before committing and `pnpm mutate:changed` on the touched shared-types and backend files; the new module should leave no surviving mutants.

## Out of Scope

- Choosing one purchase source on the server (the database rows vs the fun-fact purchase cache): candidate 2, the Coin ledger.
- Moving the power-up refusal rules into a shared offer module that the phone renders: candidate 1, the Power-up offer.
- Removing the dead per-round quickfire gates in the extra-joker and purchase refusals, or adding a shared Quiz mode module: candidate 4.
- Any change to how many points a doubled round is worth, to the joker multiplier, or to bonus awards (still never doubled).
- Any change to what the moderator sees on `/control`, so no `/guide` update; no behaviour change, so no `DOCUMENTATION.md` update beyond what the glossary term needs.

## Further Notes

- Commit scopes: `shared-types` for the module and its test, `backend` for the SQL fragment, the parity test and the server callers, `frontend` for the phone callers, `docs(repo)` (or the same commit) for the glossary term.
- Suggested order: the shared module with its table test; the SQL fragment with the parity test, then switch the standings and ended-sessions read onto it; then the in-memory server callers; then the phone. Each step leaves every existing spec green.
- The review's top recommendation (candidate 1, Power-up offer) takes this module as an input for the extra joker, so landing this first makes candidate 1 smaller.
