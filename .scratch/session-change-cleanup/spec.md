# Every session write reads live results; the one-caller session updates are inlined

Status: ready-for-agent

Source: architecture review 2026-11-18, candidate 5 ("Inline session-updates helpers; derive touchedScores", rated "speculative").

## Problem Statement

A developer writing or changing a change module in the Live session module has to get two things right that nothing checks.

- **`touchedScores` is set by hand.** Each change module returns a `SessionChange` with a `touchedScores` flag. About 25 places set it. When it is true, the Session write module reads the live results (standings, fun fact data, participants, departed teams) before storing the session, and flags league tables when the session was already ended. When it is false, the stored session keeps the old live results. A change module that writes something the live results depend on (answer points, grades, bonus awards, purchases, jokers, the roster, the quiz's structure) but sets `false` fails silently. The leaderboard, fun facts and league tables stay stale until some later write happens to set `true`. No test catches that. The flag's own doc comment lists only "answers, grades, bonus awards or the roster", which already misses purchases, jokers and live edits. The Session write module's doc comment also says "every session write ends with" the live results read, which isn't true today.
- **The session-updates module is shallow.** Its header promises that "nothing outside the module can change one field without the derived caches that depend on it". It keeps no such promise: most helpers are a one-field spread (`{ ...session, breakEndsAt }`) with a single caller, and no derived cache is involved. A reader has to open the module to learn that a helper does nothing, and the header makes them look for a guarantee that isn't there.

Teams, the quiz master and the moderator see nothing today. The cost is a class of silent stale-standings bugs, plus indirection that misleads.

## Solution

- **Drop `touchedScores`.** Every session write reads the live results before it stores the session, so the Session write module's doc comment becomes true. A change module can no longer forget to refresh the standings, because there is nothing left to forget. League tables are flagged when the session enters or leaves `ended`, or when it was already ended and the live results read changed the leaderboard or the departed teams. A changed result, not a hand-set flag, now triggers the flag.
- **Inline the one-field helpers** into their single callers. Keep the helpers that hold a real rule: the seat checks (`requireSeat`, `seatOfSocket`), the showdown round that resets the reveal step (`withActiveShowdownRound`), and the player-count cache that ignores a null count (`withPlayerCount`, which has two callers). Rewrite the module's header to say what it holds now: seat lookups and the session updates that carry a rule.

Nobody on the night sees a difference. The leaderboard and big screen show the same results. The only visible change is that a stale-standings bug from a wrong flag can no longer happen.

## User Stories

1. As a developer writing a new change module, I want the session write to refresh the live results on its own, so that I can't leave the standings stale by setting a flag wrong.
2. As a developer adding a new thing that affects scores (a new power-up, a new kind of award), I want the leaderboard to follow without me finding and flipping a flag, so that the new feature is right on its first night.
3. As a developer reading the Session write module, I want its doc comment ("every session write ends with the live results read") to be true, so that I can trust what the module says it does.
4. As a developer reading a change module, I want a one-field update written inline as a spread, so that I see what it changes without opening another file.
5. As a developer reading the session-updates module, I want its header to describe what it actually holds, so that I don't look for a cache guarantee that isn't there.
6. As a developer, I want the seat checks to stay in one place, so that every team event still checks its seat the same way.
7. As a developer, I want the showdown round's "reset the reveal step when it is on air" rule to stay in one helper, so that a fresh sudden-death round still starts at its first step.
8. As a developer, I want the player-count cache's "a null count leaves the cache alone" rule to stay in one helper shared by its two callers, so that the rule isn't copied.
9. As a developer, I want a showdown guess with no active round to stay a no-op, so that a late guess after the round moved on still changes nothing. The rule moves inline with its only caller.
10. As a quiz master, I want the leaderboard on `/control` and the big screen to show the same results as today after every press, grade, award and edit, so that the change is invisible on the night.
11. As a quiz master, I want the league tables to refresh when a session ends, when an ended session is reopened, and when a fix after the end changes the results, so that the league stays right.
12. As a quiz master, I want a write that changes no result in an ended session (a team's feedback, a text-scale change) not to trigger a league tables refresh, so that the league isn't recomputed for nothing.
13. As a team, I want my answers, joker and purchases to keep landing in the standings as they do now, so that my score is right.
14. As a team on a phone, I want a connect, reconnect or player-count report to keep taking effect at once, so that the extra live results read never makes the game feel slower.
15. As a developer, I want a live results read that fails during a write to keep the earlier results and log, as it does now, so that a database hiccup never loses the write.
16. As a developer writing a write-gate test, I want the standings gate to be reached on every write, so that interleaving tests can pause at it for any write.

## Implementation Decisions

- **`SessionChange<T>`** loses `touchedScores`: `{ session, outcome }`. Every change module stops setting it. That covers the move committer (its `touchedScores: true` literal type goes too), answers, bonus awards, jokers, purchases, roster, player count, sides, feedback, showdowns, settings, league, timer expiry, and live edit's quiz edit change. The answers module's refresh helper stops returning the flag.
- **Session write commit** always waits at the standings gate and runs the live results read on the session to store. Failure handling stays as it is (the live results read keeps a result's earlier value and logs).
- **League tables flag**: set when the status enters or leaves `ended`, or when the session was ended both before and after and the stored leaderboard or departed teams differ from the started session's (a structural comparison). It replaces the old `wasEnded && refreshedStandings`.
- **Cost (accepted)**: writes that used to skip the read now pay for its four queries, for example connect and disconnect, showdown guesses, player counts, feedback, settings and timer expiry. Writes are queued per session, so each one adds that read's latency to the queue. At pub-quiz scale (one instance, tens of teams; see CLAUDE.md) this is small, and the scoring writes that matter most already pay it.
- **Session-updates module**: the one-field helpers with one caller are inlined as spreads into their callers. That covers `withTeams`, `withTeamConnected`, `withoutTeamConnection`, `withAnsweredTeamIds`, `withBreakEndTime`, `withDisplayTextScale`, `withDisplaySoundMuted`, and `withShowdownGuess` (its no-op-without-a-round rule and its replace-the-guess rule move with it). `requireSeat`, `seatOfSocket`, `withActiveShowdownRound` and `withPlayerCount` stay, and the header is rewritten to match. This keeps `withPlayerCount`, which the review counted among the helpers to delete: it has two callers and a real rule.

## Testing Decisions

- A good test drives the Session write module or a socket event and asserts what is stored or broadcast. It never asserts which helper ran or whether a flag was set.
- Seams, highest first, all existing:
  - **Session write spec** (prior art: the session write spec and the write-gate spec): a change that writes a bonus award, or any input to the live results, and returns only `{ session, outcome }` is stored with the fresh leaderboard. In an ended session, a write that changes the leaderboard flags league tables, and one that changes nothing doesn't. Entering and leaving `ended` still flag them. A failing live results read still stores the write with the earlier results.
  - **Write-gate specs** (prior art: the feedback and showdown write-gate specs): update any that relied on a write *not* reaching the standings gate.
  - **Change module and gateway specs**: unchanged behaviour. They pass after the flag is removed and the helpers are inlined, with no new assertions.
- Run `pnpm crap:changed` and `pnpm --filter backend mutate:changed` on the touched files before committing (CLAUDE.md). The Stryker-disable comments on the old flag (for example in session settings) go with it.

## Out of Scope

- Making the live results read cheaper or incremental. If a measured night shows the extra reads hurt, the fallback is to skip the read for writes that touch no database row. That is decided by the write, not set by hand.
- Reworking `SessionOutcome` or the sync channels (review candidate 1, `team-view-projection`) and status-transition effects (candidate 2).
- Moving or renaming the session-updates module.
- Any change visible to teams, staff or the big screen.

## Further Notes

- The review offered two ways to get rid of the hand-set flag: derive it from the writes, or check it per module. Deriving it would mean tracking database writes under each change (MikroORM flushes as well as raw Knex), which is a new seam and easy to get wrong. A per-module check only catches a wrong flag after the fact. Always reading deletes the flag and removes the bug class for the cost of a few queries, so this spec takes that route.
- The `team-view-projection` spec also edits change modules (their outcomes). If both run at once they collide on the same lines. So this spec waits for `team-view-projection`, which goes first. `transition-rules` (candidate 2) also waits for it.
- No glossary or `DOCUMENTATION.md` change: nothing about statuses, the protocol or behaviour changes.
