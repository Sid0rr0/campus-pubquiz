# Spec: One table of phase deadlines

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-28, candidate 2 ("One table of phase deadlines"). Seams agreed with the user in the same session.

## Problem Statement

A live session has three **Phase timers** (the question lock, the kahoot question timer and the joker pick deadline), each armed from a deadline stored on the session. The set of three deadlines is spelled out by hand in each place that handles them:

- the deadline change shape and the function that builds it;
- the Session write's check for whether a write moved a deadline, which names each field itself;
- the phase timers' three timer registries, their three re-arm calls, three clear calls, three near-identical expiry handlers and the three-slot scheduler swap the test harness injects.

Adding a fourth deadline compiles while only part of it is wired up. The worst case is silent: if the new field is added to the deadline change shape but not to the "did a deadline move?" check, a write that moves only that deadline reports no deadline change. The delivery step never re-arms its timer, and the session-write guard that throws on an unreported deadline never fires either. On stage, a countdown would run out and nothing would happen. Every developer touching phase timers has to know to update about eight places, and nothing tells them they missed one.

## Solution

One phase deadline table lists every phase deadline once: the session field it reads and the label its expiry logs under. Everything that handles "each phase deadline" loops over that table:

- building the deadline change;
- the Session write's moved-check;
- arming, clearing and expiry handling in the phase timers;
- the scheduler swap.

The table is type-checked to cover exactly the deadline change's keys, so a new deadline won't compile until it has a row. Once it has one, it is reported, re-armed, cleared, restored after a restart and advanced on expiry with no other edits. Behaviour on stage is unchanged.

## User Stories

1. As a developer adding a new phase timer, I want to add one table row (plus its settle compute), so that I can't half-wire a deadline.
2. As a developer, I want the type checker to refuse a deadline change key that has no table row, so that a forgotten deadline fails the pre-commit typecheck instead of failing live.
3. As a developer, I want the type checker to refuse a table row for a key the deadline change doesn't have, so that the table can't drift the other way.
4. As a developer, I want the Session write to report a deadline change whenever any tabled deadline moves, so that a new deadline is re-armed without touching the Session write.
5. As a developer, I want arming a session's timers to loop over the table, so that a new deadline is armed, re-armed and cleared like the others.
6. As a developer, I want clearing all timers to loop over the table, so that shutdown never leaves a new deadline's timer running.
7. As a developer, I want restoring after a restart to arm every tabled deadline, so that a new deadline survives a redeploy.
8. As a developer, I want every expiry to run through one handler that reads the deadline's key and label from the table, so that the three near-identical handlers become one.
9. As a developer, I want an expiry's failure log to keep naming which timer failed ("Auto-lock", "Kahoot auto-lock", "Joker pick close"), so that the logs read the same as today.
10. As a developer writing a timer spec, I want the real-store harness to keep giving me `lock`, `kahoot` and `jokerPick` timer controls, so that no existing spec changes.
11. As a developer, I want the scheduler swap to be keyed by deadline name, so that a new deadline gets its own swappable scheduler without editing the swap's shape by hand.
12. As a quiz master, I want the question lock to still fire when the lock grace period runs out, so that a block still locks on its own.
13. As a quiz master, I want a kahoot question still to close when its time runs out, so that kahoot rounds still move on by themselves.
14. As a quiz master, I want the joker pick still to close after its minute, so that the night doesn't wait for a slow team.
15. As a quiz master, I want a timer whose deadline a press of mine already moved to still do nothing when it fires, so that the quiz never skips a step.
16. As a quiz master, I want each session's timers still independent of other sessions' timers, so that two quizzes running side by side don't trip each other.
17. As a quiz master, I want timers still re-armed after a backend restart, so that a redeploy mid-quiz doesn't stall a countdown.

## Implementation Decisions

- **Phase deadline table:** a constant next to the deadline change shape, one row per phase deadline, holding its key (the session field) and its expiry log label. It is checked with `satisfies` against a record over exactly the deadline change's keys, so a missing or extra row is a type error. The deadline change shape stays the source of the key set, and its fields don't change.
- **Building the deadline change** (`deadlinesOf`) is derived from the table rather than listing the fields.
- **Session write moved-check:** compares the before and after session on every key in the table. The "a deadline moved with nowhere to report it" guard is unchanged.
- **Phase timers module:** holds one timer registry per table key instead of three named fields. `arm`, `clearAll` and `restoreAll` loop over the table. The three decorated expiry handlers collapse into one, still decorated to fork its own request context, which takes the deadline key and reads the label from the table. Its "only advance if the session still holds the deadline this timer was armed to" behaviour and failure logging are unchanged.
- **Scheduler swap:** the injected schedulers become a record keyed by deadline name, with every key optional and falling back to the real-timer scheduler as now. Nothing provides it in production. The real-store harness builds that record from its existing three manual schedulers and keeps exposing them to specs as `lock`, `kahoot` and `jokerPick`.
- **Timer expiry change module stays as it is.** It takes the deadline key it already takes. It was split out on purpose (one change module per event), so this spec doesn't merge it into the move committer.
- **Settle computes stay per deadline.** Each deadline's due time is still worked out by its own settle function in the shared types. The table doesn't try to cover them, because how each due time is computed really is different.
- No change to the socket protocol, the stored session columns, the outcome shape or any timing.

## Testing Decisions

- A good test here drives a live session through the real-store harness and its manual timer schedulers: start, press, fire a timer, restart. It asserts what the session and the clients see. It doesn't assert which registry or loop ran.
- **Existing phase timer specs are the acceptance test:** phase timer lifecycle, the phase timer harness, question lock auto-advance, question lock timer isolation, kahoot question auto-advance, the kahoot question timer, joker pick, outcome delivery and timers, and outcome delivery deadlines. They all pass unchanged.
- **The timer registry spec** passes unchanged; the registry itself isn't modified.
- **Session write spec:** add one case: a write that moves only one of the deadlines (the joker pick deadline, say) reports a deadline change carrying all three current deadlines. Today nothing tests the moved-check directly.
- **The type checker** covers the drift itself: pre-commit and CI both run `typecheck`, and a deadline key with no table row fails it.
- Prior art: the real-store harness timer controls in the game tests, and the session write spec's direct cases.

## Out of Scope

- Merging the timer expiry change module into the move committer (the change module per event pattern stays).
- Renaming the timer registry, which is named for the question lock but serves all three timers.
- Adding a fourth phase deadline. This spec makes that cheap; it doesn't add one.
- Moving the per-deadline settle computes into the table.
- The kahoot round check written inline in several places, and the other review candidates.

## Further Notes

- No `GLOSSARY.md`, `DOCUMENTATION.md` or `/guide` change: the Phase timers term already names the three timers and their behaviour, and nothing users see changes.
- Mutation testing: the phase timers and session write are in the `mutate:db` set. A loop that replaces hand-listed fields should leave fewer "copy-only" survivors, so re-check the existing Stryker disable comments in those files after the change and drop any that no longer apply.
