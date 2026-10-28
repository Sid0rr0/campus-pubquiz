# Spec: Saved progress is one shape from save to restore

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-28, candidate 5 ("Collapse the saved progress names", rated *worth exploring*). Pairs with `.scratch/stats-played-questions/` (candidate 1), which reads the opened questions this spec touches.

## Problem Statement

Nobody running a quiz night sees this problem. Developers do: every time the backend learns to remember something new across a restart, the change spreads much further than it should.

What a session saves so a restart resumes it (its progress, phase timer, opened questions and revealed kahoot questions) goes by three type names: the persisted progress, the saved placement and the saved phase timer. Restore loads the persisted progress, then splits it: progress goes into one argument of placement, and everything else goes into a second, optional "saved placement" argument. The opened and revealed-kahoot id lists are then pulled back out of that argument, defaulted one at a time, handed to Settle, and grown there by two near-identical functions. Session creation calls the same placement with no saved argument at all.

Each grows-only id set is written out by hand at every step along that path. Its "saved before this was tracked" case is also handled at more than one step: the opened questions are `null` in storage, defaulted to empty at placement, then backfilled by Settle. Adding the revealed kahoot questions (commit cf79b268) touched 12 files. The next set the session must remember across a restart will touch as many, and missing one step compiles fine and drops the set silently after a restart.

## Solution

There is one name for what a session saves, the **persisted progress**, and it travels whole from load to placement:

- Placement takes the session and its persisted progress, or nothing for a brand-new session, which starts in the lobby. Restore no longer splits the saved data and rejoins it.
- The repository fills in the "saved before this was tracked" case when it loads, so an old session's missing opened questions come back as an empty list. From then on, every id set is a plain list.
- Settle grows the opened questions and the revealed kahoot questions through one shared step: it unions the stored ids with the ids the new position implies. Each set supplies only its "what this position implies" rule.

Moderators, teams and the big screen see no change. A restart resumes every session exactly where it was, as it does today.

## User Stories

1. As the moderator, I want a session restored after a backend restart to resume at the same question, status and phase timer, so that a redeploy mid-quiz costs only the ~10s freeze.
2. As the moderator, I want a restored session to keep every question it had opened, including ones Previous stepped back past, so that live-edit freezes and the Night brief stay right after a restart.
3. As the moderator, I want a restored session to keep every kahoot question whose reveal aired, so that teams still can't answer a revealed kahoot question after a restart.
4. As the moderator, I want a session saved before opened questions were tracked to restore with its opened questions worked out from where it stands, so that old sessions keep working.
5. As the moderator, I want a session saved before revealed kahoot questions were stored to restore with the ones it has moved past, so that old sessions keep refusing late answers.
6. As the moderator, I want a session saved under the retired `locked` status to restore as an open question, as today, so that old rows still load.
7. As the moderator, I want a brand-new session to start in the lobby with no opened or revealed questions, so that creating a session is unchanged.
8. As the moderator, I want the phase timer of a restored session to show the real elapsed time, downtime included, as today, so that timers don't reset on a restart.
9. As the moderator, I want a restored session's auto-lock deadline to re-arm fresh, as today, so that the room isn't locked out the moment the backend comes back.
10. As a team, I want my phone to reconnect to a restored session and see the same screen as before the restart, so that a redeploy doesn't lose my place.
11. As a developer, I want one type name for what a session saves, so that I don't have to learn three names for one idea.
12. As a developer, I want placement to take the persisted progress whole, so that restore is one call and not a split and rejoin.
13. As a developer adding a new grows-only id set, I want to add a column, a field on the persisted progress and the set's "what this position implies" rule, so that the change touches a handful of files instead of 12.
14. As a developer, I want a grows-only id set added to the persisted progress but never grown by Settle to fail a test, so that missing a step can't silently drop the set after a restart.
15. As a developer, I want the "saved before this was tracked" case handled once, at load, so that no later step has to default a missing list.
16. As a developer, I want the move committer's save to keep writing the same columns, so that no migration is needed.
17. As a developer, I want the restart specs that use the real-store harness to pass unchanged, so that I can trust the refactor didn't change behaviour.

## Implementation Decisions

- **One name.** The persisted progress (the repository's type) is the only name for what a session saves. The saved placement type goes away. The saved phase timer stays, as the slice of the persisted progress that Settle resumes instead of deriving. The persisted progress is that slice plus the progress and the id sets, so the phase-timer fields are declared once.
- **Placement's interface.** The move committer's `place` takes the session and the persisted progress, or `null`. With `null` it places at the lobby progress. With a value it places at the saved progress and resumes the saved phase timer and id sets. Both callers (restart restore and session creation) pass what they have, with no splitting, and restore passes exactly what the repository loaded.
- **Load fills in the old case.** The repository's `load` turns a `null` opened-questions column into an empty list, next to its existing retired-`locked` status mapping, so the persisted progress's id sets are plain lists. Settle already derives every opened question from the restored position, so an empty list restores the same set the `null` did. The column stays nullable and old rows aren't rewritten, so there is no migration.
- **One backfill step in Settle.** Settle grows each grows-only id set through one shared step: the session's stored ids, plus the ids the new position implies, de-duplicated and in first-seen order. The opened and revealed-kahoot rules each provide only "what this position implies". The ordering and the "only ever grows" guarantee live in the shared step. The names withOpenedAt and withRevealedKahootAt go away or become those rule functions.
- **Save is unchanged.** The move committer still builds the persisted progress from the committed session and saves it. Every column is written as today.
- **No protocol, snapshot or stored-data change.** `SessionState` keeps its field names.
- **Docs.** `GLOSSARY.md`'s **Settle** and **Commit a move** entries describe behaviour that doesn't change, so they need no edit. `DOCUMENTATION.md` needs none either.

## Testing Decisions

- **Good tests here check behaviour from outside:** save a session at some point, restart, and check what the restored session shows. They never assert on the persisted progress's internal shape beyond what the repository round-trips.
- **The main seam is the real-store harness's `restart()`** (backend, Jest, DB-backed). It rebuilds the module and gateway over the same database, as a backend restart would. The existing restart specs (opened questions, ungraded restore, phase timer lifecycle, kahoot reveal refusals) are the prior art and must pass unchanged. Add one restart case if none exists yet: a session restored after a kahoot reveal still refuses an answer to that question.
- **Settle (shared types, Vitest)** stays the seam for the backfill rule. The existing session-settle cases for both id sets (grows only, derived for a session saved before they were stored) must pass unchanged. Add one case that pins the shared step: a set's stored ids are kept even when the new position implies none of them (Previous stepping back).
- **The repository spec** gets one case: a row whose opened-questions column is `null` loads as an empty list. Its existing round-trip cases change only where they expected `null` back.
- The "a new set added but never grown fails a test" story is covered by the shared step being the only way Settle produces the id sets. A new set's restart spec, modelled on the opened-questions one, is the guard the next change adds.

## Out of Scope

- Rewriting old rows or making the opened-questions column non-nullable.
- Any other field of the persisted progress, or persisting what is deliberately in memory only (the ungraded set, closest_guess summaries, the reveal step).
- Changing what the repository saves, or when.
- The stats module's own opened-question query, which is candidate 1 in `.scratch/stats-played-questions/`.

## Further Notes

- The review rated this *worth exploring*: it changes no behaviour and pays off on the next grows-only set the session must remember across a restart.
- If candidate 1 lands first and reads the opened questions through the session, nothing here conflicts. The two touch different modules.
