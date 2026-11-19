# Joker doubling goes through one shared step

Status: ready-for-agent

Source: architecture review 2026-11-18, candidate 4 ("Make ADR 0004's 'one shared step' for joker doubling actually one", rated "worth exploring"). Candidate 1's spec, `team-view-projection`, takes the phone half of candidate 4 (the phone reads its doubled rounds from the team view). This spec is the rest: the counted-points step on the server and in `shared/types`.

## Problem Statement

ADR 0004 says a **Doubled round**'s points are derived as points are summed, never stored, "so they all go through one shared step". There is one shared rule for *which* rounds are doubled (the **Doubled rounds** module: `doubledRoundIds`, `doubledRoundIdsOfTeam`, `doubledRoundIdsOfSession`). Its SQL twin (`doubledRoundsQuery`) is kept equal by a parity spec. But *applying* the doubling to points happens in four places, each in its own way:

- **Standings** (round points, quiz points, session result, league table): SQL, multiplying by `JOKER_MULTIPLIER` inside the round-points query.
- **Read-model cells** (scoresheet, session detail, team history): the backend's `cellPoints`, fed an `isJoker` flag from the ended-sessions read.
- **Fun facts** (best joker, joker backfired): sums raw answer points per team and round itself, then calls `jokerRoundPoints`. It does count the **Extra joker** (it reads `doubledRoundIdsOfTeam`). The review left this unchecked; it is checked now.
- **The phone**: works out the team's doubled rounds itself, from its joker, its purchases and the players view's joker-round list (`doubledRoundsOf`, `jokerMarksOf`). It then works out the "+N" joker bonus on a revealed answer (`jokerExtraPoints`).

The parity spec covers only the first two, which share SQL. Fun facts and the phone sit outside it. The phone is the bigger leak. It holds game logic (which rounds count double for this team) built from two separately synced inputs, the joker and the purchases. A sync that drops one of them shows the team a wrong "Round N scores double" banner or a wrong joker border.

Nothing is broken today. The cost is locality: changing how doubling counts (the multiplier, a new way to double a round) means finding four sites, and only two of them are tested together.

## Solution

- The Doubled rounds module in `shared/types` gains the one TypeScript step that turns an answer's stored points into its counted points: `countedPoints(pointsAwarded, isDoubled)`. The read-model cells, fun facts and the phone all call it, and nothing else multiplies by the joker. The standings SQL stays as the step's set-based twin, and the parity spec now checks that the SQL totals equal the TypeScript step summed over the TypeScript rule.
- The phone's doubled rounds: see `team-view-projection` ticket 03, not this spec.

Teams, the quiz master, the moderator and the big screen see no difference: the same banners, borders, badges, "+N" bonuses, fun facts, totals and scoresheets.

## User Stories

1. As a developer changing what a joker multiplies by, I want one TypeScript function and its SQL twin to be the only places I edit, so that standings, scoresheets, fun facts and the phone all follow.
2. As a developer, I want a test to fail if the standings SQL and the TypeScript counted-points step disagree on a team's round total, so that the two forms of the step can't drift.
3. As a developer reading fun facts, I want "best joker" and "joker backfired" to read counted points from the shared step, so that the facts can't count a doubled round differently from the leaderboard.
4. As a developer, I want the backend's `cellPoints` gone and its callers to use the shared step, so that there is one counted-points function, not one per workspace.
5. As a team, I want a revealed answer in a doubled round to keep showing its "+N" joker bonus (nothing on a zero or ungraded answer), so that I see what the joker earned me.
6. As a quiz master, I want the standings, round points and 2× marks on `/control` unchanged, so that the change is invisible on the night.
7. As a moderator reading a scoresheet, session detail or team history after the night, I want each cell's points and joker mark unchanged, and the cells still adding up to the team's total, so that past nights read the same.
8. As someone watching the big screen in a break, I want the joker fun facts unchanged, extra jokers included, so that the facts match the leaderboard.
9. As a developer, I want a pure test in `shared/types` for the counted-points step, so that the rule is checked without Postgres.

## Implementation Decisions

- **Doubled rounds module (`shared/types`)** gains:
  - `countedPoints(pointsAwarded: number, isDoubled: boolean): number`: the stored points, times `JOKER_MULTIPLIER` when doubled. `jokerRoundPoints` folds into it, so its callers move over and it is removed. `JOKER_MULTIPLIER` stays exported for the SQL.
- **Backend read-model cells**: `cellPoints` is deleted. The scoresheet, session detail and team history call `countedPoints(answer.pointsAwarded, answer.isJoker === true)`. The ended-sessions read still produces `isJoker` per answer from `doubledRoundsQuery`, and that doesn't change.
- **Standings SQL** stays as it is (set-based, `JOKER_MULTIPLIER`). Its doc comment points at `countedPoints` as its TypeScript twin.
- **Fun facts**: the joker facts work out a team's counted points in a revealed round through `countedPoints`. They don't call the multiplier themselves. Which rounds count is still `doubledRoundIdsOfTeam` (extra joker included). The "extra points" figure is counted minus stored.
- **Phone**: its "+N" joker bonus calls `countedPoints`. That is its one use of the step. `team-view-projection` ticket 03 later deletes the phone's calculation outright.
- **Parity spec**: extended so that for each existing case it also compares each team's standings round total (SQL) with the sum of `countedPoints` over that team's answers, where `isDoubled` comes from `doubledRoundIds`. One spec now guards both the rule and the step.
- ADR 0004 stands: doubling stays derived. Its "one shared step" sentence becomes true as written. No ADR edit is needed. If a sentence naming the step's two forms (TS and SQL) is wanted, add it to the ADR in the same commit.

## Testing Decisions

- A good test drives an external interface (a pure function's inputs and outputs, a reducer action, a socket payload, a DB-backed read) and asserts what a team or moderator would see. It never asserts on which helper got called.
- Seams, highest first, all existing:
  - **`shared/types` pure tests** (prior art: the doubled-rounds test, the fun-facts test): `countedPoints`, and fun facts' best-joker and backfired figures unchanged with an extra joker.
  - **Backend DB-backed parity spec** (prior art: the doubled-rounds parity spec under standings): the SQL round totals equal the summed TS step, for every existing case.
  - **Frontend joker-round tests**: the "+N" bonus is unchanged.
- Existing tests of `cellPoints` move to the shared step or are deleted with the function. They are not kept as duplicates.
- Run `pnpm crap:changed` and `pnpm mutate:changed` on the touched files before committing (CLAUDE.md).

## Out of Scope

- The phone's doubled-rounds list and the team view: `team-view-projection` (review candidate 1) owns them.
- Status-transition effects (candidate 2) and the pass-through collapse (candidate 3).
- Replacing the standings SQL with TypeScript summing, or storing doubled points (ADR 0004).
- `leaderboard-board` and `rank-callouts`: they already ask the Doubled rounds module which rounds are doubled and never multiply points.
- Any change to what teams, staff or the big screen see.

## Further Notes

- Fun facts already count the extra joker (via `doubledRoundIdsOfTeam`), so the review's open question has its answer and no behaviour fix is needed there.
- Per the user's memory note, "no power-ups for X" must cover the round-level extra joker. Every rule above treats the extra joker as one more way to double a round, through `doubledRoundIdsOfTeam`.
- Docs: no glossary or `DOCUMENTATION.md` change. Nothing about the protocol or behaviour changes.
