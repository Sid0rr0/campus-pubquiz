# Spec: One Ended-sessions read for which nights count and who took part

Status: ready-for-agent

Blocked by: `.scratch/session-result-module/` (this is the loading half of that spec; build it after the Session result module lands)

Source: architecture review 2026-10-20, candidate 4 ("Worth exploring", local-substitutable).

## Problem Statement

Every screen that looks back at past nights first has to answer three questions: which sessions count (only ended ones), which teams took part in each, and what the night was called and was worth. Each backend service answers these again in its own SQL, and the answers have drifted apart:

- **The team directory and the team page count a team's nights differently.** The `/teams` directory's **Sessions played** column counts the team's roster rows. It counts sessions that haven't ended (a lobby the team joined, a night still running) and misses every night the team was kicked from or left, even when it left answers or bonus awards behind. The team page's `sessionsPlayed` counts ended sessions the team took part in: on the roster, or kicked or departed with answers or bonus awards. So a team that was kicked from one night, or is sitting in tonight's lobby, shows a different number in the directory than on its own page.
- **"Took part" is written in SQL twice.** The Standings module defines it per session: on the roster, or a mark left in answers or bonus awards. Team history copies the same union by hand, filtered by team instead of by session. A change to who counts as a participant (for example, a new kind of mark a team can leave) has to be made in both places, and nothing checks that it was.
- **"Ended" is filtered in six places.** The league's nights, team history's participations and its single-night view, and the stats list, the stats session detail and the feedback trends each add the ended-status filter themselves. A new reader that forgets it shows a night that is still being played.
- **The night's display name is written five times.** "The session's custom name if set, else its quiz's title" appears in the stats service (as a helper and again as a SQL sort expression), twice in team history, in the league service and when a session is created. They agree today, but only by repetition.
- **Max points is summed in SQL in two places.** The stats list sums a quiz's question points in its own subquery so it can sort by it. Team history has another copy (the Session result spec removes that one, but leaves the stats list's).

For a developer, each new reader of past nights (the league, the team page, feedback trends) has copied these queries, and the edge cases (kicked teams, sessions not yet ended) are only reached by large per-service Postgres specs. That is how the directory's count drifted unnoticed.

## Solution

A single **Ended-sessions read** module in the backend owns the database side of looking back at past nights:

- **which sessions count:** ended sessions only, with each session's id, join code, quiz, display name, date played and max points;
- **who took part:** for a set of sessions or a set of teams, every team on the roster or with an answer or bonus award left behind;
- **how many nights each team played:** the number of ended sessions it took part in.

The Standings module, the league, team history, the team directory and the stats service all read from it. Once it lands, "took part", "ended", the display name and max points each have one definition.

What changes for users:

- The team directory's **Sessions played** for a team equals the **Sessions played** on that team's page. It no longer counts a lobby or a running night, and it now counts a night the team was kicked from or left after answering or receiving a bonus.
- Sorting the directory by Sessions played orders teams by that same number.
- Nothing else visible changes. Session names, max points, which nights each screen lists and who took part in them stay the same on every screen.

## User Stories

1. As a team, I want the directory's Sessions played to equal the number on my team page, so that the two never contradict each other.
2. As a team that was kicked from a night after answering, I want that night counted in the directory's Sessions played, as it already is on my team page, so that my history isn't shortened by the kick.
3. As a team that left a night after receiving a bonus award but before answering, I want that night counted as played, because the bonus shows I took part.
4. As a team sitting in tonight's lobby, I want the directory not to count tonight until it ends, so that Sessions played only counts finished nights.
5. As a team on the roster of a night that is still running, I want it not counted yet, matching my team page.
6. As a team on the roster of an ended night that answered nothing, I want that night still counted as played, as today on my team page.
7. As a moderator sorting the team directory by Sessions played, I want the order to follow the number shown, so that the sort agrees with the column.
8. As a moderator, I want a team with no ended nights to show 0 and sort with the other zeros, as today.
9. As a quiz master, I want every screen to name a night the same way (its custom name, else its quiz's title), so that the stats list, the team page, the league and the session list all agree.
10. As a quiz master sorting the stats list by session name, I want the sort to use the same name the column shows, as today.
11. As a quiz master sorting the stats list by max points, I want max points summed the same way the team page and the stats detail sum it, so that the list and the detail never disagree.
12. As a quiz master, I want the stats list, the stats detail, the feedback trends, the league and the team page never to show a night that hasn't ended, so that half-played nights don't leak into results.
13. As a team opening one past night on the team page, I want it found only if it has ended and I took part, as today.
14. As a league organiser, I want a league's table to include only its ended nights, as today.
15. As a quiz master viewing feedback trends, I want only ended nights that collected feedback in the range or league, as today.
16. As a team kicked from a night, I want the Standings, the team page and the directory to agree that I took part, so that one rule decides it everywhere.
17. As a developer, I want "took part" defined once, so that a new kind of mark a team can leave is a change in one place.
18. As a developer, I want "only ended sessions" to be the default of the read I use, so that I can't forget the filter in a new reader.
19. As a developer, I want the display name rule written once, so that a change (for example, adding the date to unnamed nights) is one edit.
20. As a developer, I want one real-Postgres spec that pins the participation and ended-status edge cases, so that the service specs don't each need kicked-team fixtures.
21. As a developer building on the Session result module, I want its loading to go through this read, so that the results of a night and the list of nights use the same participants.
22. As a developer, I want the stats list to keep sorting and paging in SQL, so that this change doesn't load every session into memory.

## Implementation Decisions

### The Ended-sessions read module

- A new backend module, the **Ended-sessions read**, lives beside the Standings module. It is a Nest provider over Knex and the only module that knows the SQL for selecting ended sessions and participants. It holds no rules about placings, totals or wins: those stay with the Standings and Session result modules.
- It is local-substitutable: its tests run against the real Postgres test database. Services that use it are not given a fake of it.
- **Took part.** A team took part in a session if it is on the roster now, or has an answer or a bonus award stored for the session. Kicking or leaving deletes the roster row but keeps answers and bonus awards. This rule does not look at session status, because the Standings module also uses it for live sessions (the live leaderboard, the "has taken part" check). The Standings module's own participants query is deleted, and Standings reads participants from this module.
- **Interface** (four reads; names are indicative):
  - **Ended sessions** — a composable query of ended sessions with columns: session id, join code, quiz id, display name, custom name, quiz title, date played and max points. Callers narrow it (by ids, by league, by date range and feedback setting), join to it, order it and page it. A composable query rather than a loaded list is needed so that the stats list keeps sorting and paging in SQL, the same way it already joins the Standings module's session totals query.
  - **One ended session** — one session's header (the same columns) by id, or nothing if it doesn't exist or hasn't ended.
  - **Participants** — for a set of session ids or a set of team ids: rows of session id, team id and whether the team is on the roster. Status-agnostic, per the rule above.
  - **Participations** — for a set of team ids: every ended session each team took part in, with the session header, newest first, with session id as the tie-break. This replaces team history's own participations query.
  - **Sessions played per team** — a composable query of team id and the count of ended sessions the team took part in, for the directory to join, sort by and page.
- **Display name** is the session's custom name if set, else its quiz's title. The module computes it in SQL for sorting and returns it on every header. One shared function holds the same rule for code that only has the two values in memory. Session creation uses that function too.
- **Max points** is the sum of the points of the questions in the session's quiz, 0 for a quiz with none. Each session plays its own copy of the quiz, so this is the session's max points. The Session result module keeps computing max points from the questions it is given. A test checks that the two agree for the same session.

### Readers

- **Standings:** its participant subquery, its "has taken part" check and its session totals query all read participants from this module. It doesn't change how it ranks, breaks ties or picks the winner.
- **Session result loading** (from the Session result spec): the Standings results read gets its session ids and headers from this module.
- **League:** a league's nights are the ended sessions narrowed to that league. It drops its own status filter.
- **Team history:**
  - A team's sessions come from the participations read. Its own union, its join to sessions and quizzes, and its own display-name expression are deleted.
  - The single-night view gets its header from the one-ended-session read and keeps using the Standings "has taken part" check.
- **Team directory:** the Sessions played column and its sort come from the sessions-played-per-team query. Its roster-row count is deleted.
  - The wire field and sort key keep their current name (`sessionsJoined`). Only the meaning changes, so the frontend and the sort query need no change. The shared type's comment is updated to say what it counts.
- **Stats:**
  - The stats list builds on the ended-sessions query and sorts by its display name and max points columns. Its own max-points subquery and its name expression are deleted.
  - The session detail gets its header from the one-ended-session read.
  - The feedback trends narrow the ended-sessions query by range or league and the feedback setting. The trends query keeps its feedback-setting filter.
  - The display-name helper is deleted.
- **Wire shapes:** no payload changes shape. Only the directory's `sessionsJoined` changes meaning.

### Docs, in the same change

- **GLOSSARY.md:**
  - add **Took part**: on the roster, or kicked or departed with an answer or bonus award left behind; used by every screen about a session.
  - add **Sessions played**: the ended sessions a team took part in, shown the same in the directory and on the team page.
- **DOCUMENTATION.md:**
  - the team directory paragraph says Sessions played counts ended sessions the team took part in, and equals the team page's `sessionsPlayed`.
  - the team page section points at **Took part** instead of restating the rule.
- No `/guide` change: the moderator's workflow on `/control` doesn't change.

## Testing Decisions

- **What makes a good test:** it seeds rows, calls the module's interface and checks only what comes back. It never asserts on the SQL text, the query builder calls or which helper ran.
- **The Ended-sessions read** gets one new real-Postgres spec, which is the main test surface for this change. It uses the per-worker cloned test database the Standings, league and team history specs already use. One case each for:
  - a roster team that answered nothing took part;
  - a kicked team with answers took part;
  - a departed team with only a bonus award took part;
  - a team that joined and was kicked before leaving any mark did not take part;
  - lobby and running sessions are absent from the ended sessions, participations and sessions-played reads, but present in the participants read (it is status-agnostic);
  - the display name is the custom name when set, else the quiz title, both in the returned header and as the sort column;
  - max points sums the session's quiz questions, and is 0 for a quiz with no questions;
  - participations are newest first, with session id breaking a tie on date;
  - sessions played per team counts kicked and departed nights and gives 0 to a team with none;
  - one ended session returns nothing for an unknown id and for a session that hasn't ended.
- **Consistency checks:**
  - in the team directory service spec, one case seeds a kicked team and a team in a lobby and checks that the directory's Sessions played equals the team history summary's `sessionsPlayed` for each;
  - in the adapter spec, one case checks that the adapter's max points for a session equals the Session result module's max points computed from that session's questions.
- **Service specs** (Standings, league table, team history, team directory, stats) keep their happy paths and the cases that test loading and HTTP shape. Cases that only exercised participation or the ended filter move to the adapter spec. The team directory cases that pinned the roster-row count are rewritten to the new rule.
- **Prior art:**
  - the Standings service spec (real Postgres, cloned per worker), in particular its session totals query and "has taken part" cases;
  - the team history service spec's kicked-team fixtures.
- E2E: run `pnpm e2e` once before the PR. No new journey: the team directory and team page smoke checks already open these screens.

## Out of Scope

- Anything the Session result spec owns: wins, placings, correct counts, correct rates, average placing and name order.
- Renaming the directory's `sessionsJoined` field or sort key to `sessionsPlayed`.
- The directory's cost of loading every team's history to sort by average placing.
- Changing who counts as a participant, or which sessions a league includes.
- Live-session reads (the live leaderboard, verdict tallies, fun fact data, league top) beyond Standings now taking participants from this module. Folding those reads together is architecture review candidate 5.
- Non-ended session lists (the session list on `/control`, seeding, import), which keep their own queries.

## Further Notes

- Test seam confirmed with the user on 2026-10-20: one new real-Postgres spec on the adapter's interface. Service specs shed their participation and status edge cases into it.
- Teams that were kicked from a night will see the directory's Sessions played go up, and teams currently in a lobby will see it go down until the night ends. Both bring the directory in line with the team page. They are the intended fix, not regressions.
- The review lists "max points ×3". The Session result spec removes team history's copy, which leaves the stats list's SQL sum (now in this module) and the Session result's sum over loaded questions. The consistency case keeps those two together.
