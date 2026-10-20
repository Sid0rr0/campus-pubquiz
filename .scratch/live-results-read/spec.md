# Spec: One live results read in place of the with* helpers

Status: ready-for-agent

Source: architecture review 2026-10-20, candidate 5 ("Worth exploring", in-process).

## Problem Statement

A live session keeps several figures derived from its stored answers and bonus awards: the leaderboard, the per-question verdict tallies (the reveal's "N teams correct") and the fun fact data the break's fun facts are computed from. Together these are the session's **live results**. They are cached on the session and must be re-read from the database whenever scores may have changed.

Two places do that re-read, and each assembles it by hand:

- **A session write** (an answer, a grade, a bonus, a roster change, a press, a quiz edit) ends by reading the three figures in parallel. Each read falls back on its own: if one fails, it is logged and the session keeps that figure's earlier value until the next write.
- **Placing a session** (creating it, or restoring it after a backend restart) reads the same three figures and also the league top. It has no fallback: one failed read makes session creation fail, and stops a restart from restoring the session.

Each place then applies the figures through a chain of one-line helpers that spread a single field into the session. These helpers fail the deletion test: deleting one and inlining its spread loses nothing.

The two paths have drifted:

- **Failure handling differs.** A write survives a failed read; placement doesn't. Placing a fresh session reads standings that can only be empty, yet a transient database error there still fails `POST /sessions`. After a restart, the same error leaves the backend unable to restore the session at all.
- **The set of figures differs, without explanation.** Placement also reads the league top; a write doesn't. That is correct, because a league top can't change from this session's scoring: the league table only counts ended sessions. But the only record of that is the code, so the next reader can't tell whether it's a rule or an omission.
- **A new derived figure is a change in two places.** Adding one means editing both fan-outs, both helper chains, and the specs that fake each read separately. The verdict tallies and the fun fact data were each added this way, and the league top was added to only one path.

For a developer, the live session module's promise is that nothing outside it can change one field without updating the caches that depend on it. That promise currently rests on two hand-kept copies agreeing.

## Solution

One **live results read** in the live session module owns the session's live results. Given a session, it reads every live result from the database and returns the session with them applied. A figure whose read fails is logged and kept as it was. Both the session write and placement end with this one read, so:

- the session's live results are always read and applied the same way;
- a failed read never fails a write, a session creation or a restart. The figure keeps its earlier value (for a fresh or just-restored session, the empty default) and the next write catches it up;
- adding a new live result is one change, in one place;
- the league top is explicitly not a live result. The league change module owns it, and placement asks that module for it by name.

What changes for users:

- Creating a session no longer fails because a standings read failed. The new session starts with an empty leaderboard, which is what it would have read anyway.
- After a backend restart, a session is restored even if a standings read fails. Until the next event in that session, its leaderboard, reveal tallies and fun facts may show their empty state. The first answer, grade, bonus or press brings them back.
- Nothing else changes. The leaderboard, the reveal tallies, the fun facts and the league top show exactly what they show today, at the same moments.

## User Stories

1. As a quiz master, I want creating a session to succeed even if the standings can't be read at that moment, so that a database hiccup doesn't block me from starting the night.
2. As a quiz master, I want a session to come back after a backend restart even if a standings read fails, so that a redeploy never loses a live quiz.
3. As a quiz master, I want the leaderboard to catch up at the next event after a failed read, as it already does mid-game, so that one failure never leaves it stale for long.
4. As a team, I want the leaderboard to show the same totals after any change, whatever kind of event caused it, so that I can trust it.
5. As a team, I want the reveal's "N teams correct" to follow hand grades, lock grading and key fixes, as today.
6. As a team on the big screen, I want the break's fun facts computed from up-to-date answers and bonuses, as today.
7. As a team, I want the leaderboard to be right straight after a restart, as today, when nothing failed.
8. As a quiz master, I want the big screen's lobby league to be read when a session is created or restored, and re-read when a league changes, as today.
9. As a quiz master, I want an answer, a grade or a bonus not to trigger a league table read, so that the backend doesn't redo a whole league's standings on every submit.
10. As a quiz master, I want a failed league top read to leave the lobby without a league rather than fail the event, as today.
11. As a quiz master, I want a failed read on one live result not to discard the others that were read successfully, so that one failure costs as little as possible.
12. As a quiz master, I want each failed read logged with the figure and session it was for, so that I can tell what was stale and why.
13. As a quiz master, I want events that don't touch scores (connections, display settings, timers, league edits) to keep skipping the results read, as today.
14. As a quiz master, I want the prior standings (the board the leaderboard compares against) to keep updating as today, so that rank movement arrows stay right.
15. As a developer, I want one function that refreshes every live result, so that adding a new one is a change in one place.
16. As a developer, I want the live session's write and placement paths to end with the same read, so that they can't drift apart again.
17. As a developer, I want the league top's absence from the results read to be a named, documented rule, so that nobody "fixes" it by adding a league table read to every write.
18. As a developer, I want the one-line helpers for the live results deleted, so that the session record has one way to receive them.
19. As a developer, I want specs that force a failed or late results read to target one read, so that a new live result doesn't mean updating every failure spec.
20. As a developer, I want the existing overlap specs (two writes whose results reads land out of order) to keep passing unchanged in what they assert, so that the refactor provably keeps the write queue's guarantees.

## Implementation Decisions

### The live results read

- A new collaborator in the live session module, the **live results read**, owns the session's live results: the leaderboard, the verdict tallies and the fun fact data. It is internal to the live session module, like the rest of the session-state code.
- **Interface:** one operation. It takes a session and returns that session with every live result replaced by a fresh read from the Standings module. It doesn't write to the database or store the session; the caller does.
- **Failure policy, the same everywhere:** the live results are read in parallel, each on its own. A read that fails is logged with the figure's name and the session's join code, and that figure keeps the value the given session already holds. The operation itself never throws because a read failed.
- **The league top is not a live result.** It doesn't depend on this session's answers or bonuses, since a league table counts only ended sessions. Reading it costs a full league table. The league change module stays its only owner: it reads it when a session is placed and when a league or the session's leagues change.
- **Adding a live result** means adding a field to the session record and its read to this operation, nothing else. A comment on the operation says so.

### Callers

- **Session write:** when a write touches scores (the default), the write ends by bringing the prior standings up to date as today, then passing the session through the live results read, then storing it. Its own parallel reads, its per-field fallback helper and its chain of field spreads are deleted. Writes that opt out of the standings read (events that don't touch scores) still skip it.
- **Placement:** placing a session (creation or restart) ends with the same live results read, then asks the league change module for the session's league top. Its own four-way read and its chain of field spreads are deleted. A failed league top read leaves the lobby with no league, as the league change module already does.
- **League change module:** it sets the league top on the session directly and keeps its read-or-null behaviour. The one-line league top helper is deleted.
- **The four one-line helpers** for the leaderboard, the verdict tallies, the fun fact data and the league top are deleted. The prior-standings helper stays, because it holds a rule (which board counts as the board before scoring). The session record's other per-field helpers (teams, connections, display settings, showdown and so on) are not part of this change.
- **Unchanged:** the write queue, the ordering guarantees, which events touch scores, the prior standings rule, the Standings module's reads and every wire payload.

### Docs, in the same change

- **GLOSSARY.md** adds **Live results**: the leaderboard, verdict tallies and fun fact data a live session holds, derived from its stored answers and bonus awards and re-read after every write that touches scores and when the session is placed. It says the league top is not one of them, and why.
- **DOCUMENTATION.md:**
  - the session write paragraph says the final read covers every live result, and that a failed read keeps that figure's earlier value;
  - the persistence and restart section says placement uses the same read and fallback, so a failed read no longer stops a session being created or restored, and the figures stay empty until the next write;
  - the verdict tallies paragraph points at **Live results** instead of restating when they are read;
  - the league top paragraph says it is read at placement and on league changes only, never on score writes, because it can't change from this session's scoring.
- No `/guide` change: nothing the moderator does on `/control` changes.

## Testing Decisions

- **What makes a good test:** it drives the game through the gateway the way clients do (joins, answers, grades, presses, restarts) and checks what the rooms are sent or the session holds. It never asserts on which helper ran or in what order the reads were made.
- **Seam: the existing real-store gateway harness.** No new seam and no unit spec for the live results read. The harness already runs the real live session module over the real test database, with the existing helpers for forcing one database call to fail or land late.
- **Specs that force a failed or late results read** target the live results read's Standings reads exactly as they do today. They assert the same outcomes:
  - the earlier leaderboard is kept after a failed read and caught up by the next change;
  - two overlapping writes end with both changes on the board whichever read lands last.
- **New cases:**
  - **creation survives a failed read:** with the leaderboard read forced to fail, creating a session succeeds, the new session's board is empty, and the first answer graded afterwards appears on it;
  - **restart survives a failed read:** with a standings read forced to fail during restore, the session is restored at its saved position, and the next write brings back the leaderboard, verdict tallies and fun fact data;
  - **one failure keeps the others:** when only the verdict tally read fails after a grade, the leaderboard and fun fact data still update and the tallies keep their earlier value;
  - **no league table read on a score write:** with the league top read spied on, an answer, a grade and a bonus don't read it, while creation and restart do.
- **Existing specs** for the leaderboard, verdict tallies, fun facts, league top and session write keep passing. Any spec that faked each live result read separately only to make a write go through now relies on the real read.
- **Prior art:**
  - the session write spec's "keeps the earlier leaderboard when the standings read after a bonus fails" and its held-read overlap cases;
  - the commit-a-move spec's "standings cannot be read after the progress is saved" case;
  - the league top spec's restart and refresh cases.
- E2E: run `pnpm e2e` once before the PR. No new journey.

## Out of Scope

- Folding the session record's other one-line helpers (teams, connections, display settings, break end time, showdown) into anything. They update state the event itself carries, not figures read from the database.
- Refreshing a live session's league top when another session in the same league ends. Today it refreshes only on league edits and session membership changes.
- Making the live results reads cheaper (for example, reading one query instead of three, or skipping the fun fact data outside the break).
- Any change to which events touch scores, the write queue or the prior standings rule.
- Ended-session reads (architecture review candidates 1 and 4).

## Further Notes

- Decisions confirmed with the user on 2026-10-20:
  - test through the existing real-store gateway harness, with no new seam;
  - the league top stays out of the live results read and is owned by the league change module;
  - one failure policy everywhere: keep the earlier value and log, including at placement.
- At placement, "the earlier value" is the fresh session's empty default. That is exactly right for a new session. After a restart it means an empty board until the next event, a trade accepted in exchange for never failing the restore.
