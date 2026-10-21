# Spec: Each change says whether it touched scores

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 8 ("Speculative", in-process).

## Problem Statement

Every **Session write** ends by re-reading the session's **Live results**, the leaderboard, verdict tallies and fun fact data. A write can skip that read when its event doesn't change scores. Whether it skips is decided by an option the game state class passes at each call site, not by the change module that does the database work. Fourteen of the game state's pass-throughs pass a "not touching scores" option by hand. The rest leave it out and get the read by default.

The same flag decides the league-tables report. When a session that has already ended has its scores changed (a late grade, a bonus edit), the write flags that league tables may have changed. The delivery step then re-reads every other live session's **League top** and redraws their lobbies. "Changed its scores" here means "the write refreshed standings", so it's the same call-site option again.

What can go wrong:

- **A wrong option silently skips two things.** If a pass-through that does touch answers, bonus awards or the roster is given the "not touching scores" option, the leaderboard stays stale after that write. On an ended session, other sessions' lobbies also never see the league table change. Nothing fails, and nothing is logged. The figures catch up only on the next write that does refresh, and on an ended session there may not be one.
- **The knowledge sits in the wrong place.** The change module knows what it wrote (an answer, a grade, a bonus award, a roster row, a feedback rating, a setting). The game state class, which is meant to be a thin set of pass-throughs (see `CODING_STANDARDS.md`), has to know it too and repeat it at each call site. A new event means a new pass-through, and nothing reminds its author to think about the option.
- **The default is "touches scores", so leaving the option out is safe but wasteful.** A new event that doesn't change scores, written without the option, costs a standings read on every press, with no warning.

No bug has come from this yet. The risk is a new event, or a change module that starts writing a bonus award or a roster row, without the call site being updated.

## Solution

Every change module's result says whether the change **touched scores**: whether it wrote answers, grades, bonus awards or the roster. The result type requires it, so the type checker rejects a change that doesn't say. The Session write reads it from the result. It reads standings only when the change touched scores, and flags league tables from the same answer. The game state class stops passing any option. Its pass-throughs become plain calls.

Nothing changes for users. Every event refreshes the leaderboard, and flags league tables on an ended session, exactly when it does today.

## User Stories

1. As a quiz master, I want the leaderboard to update after every answer, grade, bonus award, bonus edit or removal, join, leave and kick, as today.
2. As a quiz master, I want the leaderboard to update after every press (Advance, Previous, a toggle) and every timer expiry, as today.
3. As a quiz master, I want the leaderboard to update after a quiz edit or re-import regrades a session, as today.
4. As a quiz master, I want a round rating, feedback, a player count, a disconnect, a break end time, a display text size, a display sound mute, a showdown guess, a new showdown round, a settings or league change, or a league top refresh not to cost a standings read, as today.
5. As a quiz master who grades a late answer or edits a bonus on an ended session, I want other sessions' lobbies in the same league to show the updated league top, as today.
6. As a quiz master who changes feedback or settings on an ended session, I want no league top redraw, since no score changed, as today.
7. As a quiz master, I want the leaderboard never to stay stale because an event was wired up with the wrong flag.
8. As a quiz master running a league, I want a late score change on an ended night never to leave the other lobbies' league top out of date because of a wiring mistake.
9. As a developer adding a new event, I want the type checker to make my change module say whether it touched scores, so that I can't forget.
10. As a developer, I want that answer to sit with the database writes that justify it, so that reading the change module tells me why the standings are or aren't read.
11. As a developer changing a change module so that it now writes a bonus award or roster row, I want the "touched scores" answer in the same module, so that I update both in one place.
12. As a developer, I want the game state class's pass-throughs to carry no score-related options, so that they stay thin.
13. As a developer, I want a held write (inside a quiz-edit hold) to read the answer the same way, so that held and queued writes can't disagree.
14. As a developer, I want a change that both touches scores and is refused to behave as today: it stores nothing and reads nothing.
15. As a developer, I want the moves (Commit a move) to say they touched scores, since a press can grade at the lock, keeping today's always-read behaviour.
16. As a developer, I want the Session write's spec to pin, for each kind of event, whether standings were read and whether league tables were flagged.
17. As a developer, I want the glossary's Session write entry to say that the change declares whether it touched scores.

## Implementation Decisions

- **The change result carries the answer.** The result every change returns to the Session write (the new session and the outcome) gains a required **touched scores** flag. Its meaning: this change wrote answers, grades, bonus awards or the roster (team rows joining, leaving or kicked), so standings may have moved. It is required, with no default. A change that builds its result without it doesn't compile.
- **Each change module sets it from what it writes:**
  - **touched scores:** answers (submit, grade), bonus awards (award, edit, remove), roster (join, leave, kick), the quiz-edit change (reload with regrade, and lobby reloads, which today read standings by default), and Commit a move (every press and timer expiry, as today);
  - **didn't touch scores:** feedback (round rated, feedback sent), player counts (team's own and admin-set), roster disconnect, session settings (break end time, display text size, display sound mute), showdowns (guess, new round), league changes (settings and leagues, league top refresh), and setting leagues at session creation.

  Where one module has both kinds (the roster: join, leave and kick touch scores, disconnect doesn't), each operation sets its own.

- **The Session write reads it.** The write and the held write no longer take an options argument. After the change runs, the write reads the result's flag. It reads Live results only when the flag is set, and the league-tables report uses the same flag where it used the option. Everything else the write does (prior standings, the deadline report, the gate points) is unchanged.
- **The game state class drops the option.** Its 14 "not touching scores" call-site options and the option's constant are deleted, along with the Session write's options type, unless something else still needs it.
- **Behaviour is unchanged.** The flag each change module sets matches what its call site passes today, event by event. This spec is a move of the decision, not a re-think of which events touch scores. Making presses skip the read when they grade nothing is out of scope.
- **Docs:** the `GLOSSARY.md` **Session write** entry changes "A write can declare that it doesn't change scores and skip the standings read" to say that each change says whether it touched scores, and the standings are read only when it did. No `DOCUMENTATION.md` or `/guide` change is needed.

## Testing Decisions

- **A good test here runs a real event through the game and checks what happened:** whether the leaderboard reflects the change, whether a standings read ran (seen through the write gate's `standings` point or a standings read spy, as the session-write spec already does), and whether league tables were flagged and other lobbies redrawn. It doesn't assert the flag's value on a change result directly.
- **Seam:** the existing session-write gateway spec (real store, write gate) and the league-tables-changed spec. No new seam.
  - The session-write spec's "events that do not touch scores" group adds cases where needed so that each not-touching event (round rated, feedback, player counts, disconnect, break end time, text size, sound mute, showdown guess, new showdown round, settings and leagues) is shown to skip the standings read. Its existing groups (bonus, answers, roster, presses, timer expiry, quiz edits) keep showing that the touching events read it.
  - The league-tables-changed spec keeps its cases (an end, an un-end, a bonus edit on an ended session, nothing for a non-ended session) and adds one: a not-touching event (for example feedback) on an ended session flags nothing.
- **Type checking is part of the test:** a change module that builds its result without the flag fails `pnpm typecheck`, which runs in the pre-commit hook and CI.
- **Prior art:** the session-write gateway spec's write-gate interleavings and its "events that do not touch scores" group, and the league-tables-changed spec.

## Out of Scope

- Changing which events touch scores (for example letting a press that grades nothing skip the standings read).
- Detecting score changes automatically by comparing the session before and after. Answers and bonus awards live in the database, not in the session, so a before/after comparison can't see them.
- The league top read itself, and how the delivery step redraws lobbies.
- Any other part of the game state class's shape.

## Further Notes

- The review rated this "Speculative" because the game state class is shallow by design and no bug has come from it. The required flag is the cheapest form of enforcement: the type checker does the work, and the behaviour tests stay where they are.
- If presses later learn to say whether they graded anything, Commit a move can report that through the same flag with no change to the Session write.
