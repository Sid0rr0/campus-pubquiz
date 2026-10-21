# Spec: The live session summary is built where the session lives

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 6 ("Worth exploring", local-substitutable).

## Problem Statement

The admin session picker, the `/display` session picker and the response to creating a session all show an **active session summary**: join code, quiz, quiz title, display name, status, team count and when it started. The sessions controller builds that summary itself, from four calls, and builds it twice:

- **Listing** (the admin list and the public list) asks the game state for each held session's join code, quiz, status and team count. It then asks the quiz service for the quiz titles, and the seed service, in two separate lookups by join code, for each session's start time and custom name.
- **Creating** a session asks the game state to create it, then the quiz service for the one title and the seed service for the one start time. It works out the display name from the name in the request body, not from what was stored.

The two copies already disagree on one edge case. When the start time is missing, listing shows 1 January 1970 and creating shows "now". Neither can happen today, because every session row has a creation time, but the fallbacks say two different things about the same field.

The controller isn't where these facts live. A held session already loads its own row, which carries the custom name and creation time, whenever its seeded game is loaded or reloaded. The quiz title belongs to the same quiz the seeded game reloads on every quiz save. Asking for them again by join code means two extra seed-service lookups and a quiz lookup on every list request. The `/display` picker polls that list.

For a developer:

- The controller spec stubs five collaborators (game state, quiz service, seed service, leagues, live session) across about 600 lines. Much of that is setting up title, name and start-time lookups to check how they are stitched together. None of it touches a real session.
- The seed service has two lookups by join code that exist only for this stitching.
- The display-name rule is applied in the controller, separately from where the stored name is read.

## Solution

A held session knows its own summary facts. When its seeded game is loaded (at creation, at restore after a restart and at every quiz-edit reload), it carries the quiz title, the session's custom name and the time the session started. The game state's list and create both return the full **active session summary**, and the controller only parses requests, applies guards and maps errors.

A rename of an ended session from the stats page also updates that session in memory while it is still held, so the session picker shows the new name straight away.

What changes for users: nothing visible, except that renaming an ended session on the stats page now shows up straight away in the session picker. The summary's fields, the display-name rule ("custom name, else the quiz's title") and the picker's ordering stay the same.

## User Stories

1. As a moderator opening the admin session picker, I want every held session listed with its quiz title, display name, status, team count and start time, as today.
2. As a venue operator on `/display`, I want the public session list to show the same title, name and start time as the admin list, as today.
3. As a moderator creating a session, I want the response to carry the same summary the list would show for it, so that the picker can add it without refetching.
4. As a moderator creating a session with a custom name, I want the summary to show that name (trimmed), as today.
5. As a moderator creating a session with a blank name, I want the summary to show the quiz's title, as today.
6. As a moderator, I want a session's start time to be when the session was created, on both create and list, so that "Started" never shows 1970 or the time of the list request.
7. As a moderator, I want the start time to survive a backend restart, so that a restored session still shows when it really started.
8. As a moderator who renames the quiz in the editor while a session on it is in the lobby or running, I want the picker to show the new quiz title, as today.
9. As a moderator who renames an ended session on the stats page while it is still listed in the picker, I want the picker to show the new name straight away.
10. As a moderator who clears an ended session's custom name on the stats page, I want the picker to fall back to the quiz's title straight away.
11. As a moderator who renames an ended session that has already been closed, I want the rename to work exactly as today, with nothing in memory to update.
12. As a moderator, I want a team joining or leaving to change the team count on the next list, as today.
13. As a moderator, I want a status change (lobby, running, break, ended) to show on the next list, as today.
14. As a venue operator, I want the `/display` picker, which polls the public list, not to cost three extra database lookups per poll.
15. As a moderator, I want the list and the create response never to disagree about a session's title, name or start time.
16. As a developer, I want one place that turns a held session into its summary, so that a new summary field is one change.
17. As a developer, I want the display-name rule applied where the stored name is read, using the shared display-name helper, so that the picker, stats, league and Team page name a night the same way.
18. As a developer, I want the summary tested through the real store, so that a test creates a real session and lists it rather than stubbing three lookups.
19. As a developer, I want the sessions controller spec reduced to request parsing, guards and error mapping, so that it no longer stubs the quiz service or seed service.
20. As a developer, I want the seed service's two lookups by join code removed, since nothing else uses them.
21. As a developer, I want the boot-time seeded game (the hardcoded quiz on an empty database) to carry the same summary facts as one loaded from the database, so that `seed()` gives the same result whether it created the game or resumed it.
22. As a developer, I want quiz-edit reloads to refresh the quiz title along with the rounds, with no extra step.

## Implementation Decisions

- **Seeded game carries the summary facts.** `SeededGame` gains the quiz title, the session's custom name (null when none was set) and the session's start time (the session row's creation time). The seed service's game load already reads the session row, and it reads the quiz title with it. Its hand-built boot game (the hardcoded quiz) sets the same fields. They are refreshed whenever the seeded game is reloaded, so a quiz rename that goes through the Live edit save reaches every session that save reloads.
- **Game state returns the full summary.** `listSessions` returns `ActiveSessionSummary[]` and `createSession` returns the new session's summary. A single function turns a held session into its summary. It reads join code, quiz id, quiz title and start time from the seeded game, works out the display name with the shared display-name helper from the stored custom name and the quiz title, and takes status and team count from the session as today. Any snapshot `createSession` currently returns to other callers stays available to them (for example as a separate call or a richer return). The spec only requires that the controller get the summary from the game state.
- **Controller is parsing and mapping only.** The sessions controller stops depending on the quiz service and seed service for summaries. The `Unknown quiz` placeholder and both start-time fallbacks go. List, public list and create each pass the game state's summary through.
- **Rename reaches the held session.** The stats page's rename of an ended session, after updating the row, also updates the held session's custom name when that session is still held. This goes through the Session write as an ordinary write that doesn't touch scores and broadcasts nothing new. A session that has been closed (no longer held) needs no in-memory update. The rename rules (ended sessions only, a blank name clears it) are unchanged.
- **Removed:** the seed service's start-time and name lookups by join code, and the quiz service's title lookup if nothing else uses it.
- **No schema, protocol or payload change.** `ActiveSessionSummary` keeps its shape. The custom name and start time are only cached in memory from the session row.
- **Accepted edge:** an ended session that is still held isn't reloaded by an editor save (only lobby and running sessions are), so if its quiz is renamed while it's ended but not yet closed, the picker keeps the title it was played with until it's closed or the backend restarts. Today it would show the new title. This only affects the quiz title, not the session's own name.

## Testing Decisions

- **A good test here checks the summary a caller gets back**: title, display name, status, team count and start time for real sessions. It doesn't check which lookups ran or how the seeded game stores the fields.
- **Seam:** the game state's `listSessions` and `createSession`, through the real-store harness, in the existing session-lifecycle admin spec. Cases:
  - a created session's summary has the quiz title, the quiz title as name when none was given, a trimmed custom name when one was, and a start time equal to the session row's creation time;
  - the create response and the next list agree for that session;
  - status and team count follow a join and a status change;
  - after a quiz rename through the Live edit save, a lobby session's summary shows the new title;
  - after a restart (sessions restored from the store), the start time and custom name are unchanged;
  - after a stats rename of an ended, still-held session, the list shows the new name; after clearing it, the quiz title.
- **Stats rename:** the existing stats service spec's rename cases keep passing. One new real-store case checks that a held ended session's summary reflects the rename, and that renaming a closed session still succeeds.
- **Controller spec:** reduced to guards, request parsing (quiz id, name trimming, settings, league ids), error mapping, and passing the game state's summary through. The quiz-title, custom-name and start-time stitching cases move to the seam above. Its quiz service and seed service stubs are deleted.
- **Seed service spec:** the cases for the two removed lookups are deleted. A load case checks that the loaded seeded game carries title, custom name and start time, and that `seed()` gives the same summary facts whether it created or resumed the boot game.
- **Prior art:** the session-lifecycle admin spec (`listSessions` over the real-store harness) and the Live edit save's real-store specs for quiz-edit reloads.

## Out of Scope

- Renaming a session that hasn't ended (no such flow exists).
- Reloading ended sessions on an editor save, to refresh the quiz title.
- Moving the "touches scores" decision into change modules (review candidate 8).
- Any change to the session picker UI, to `ActiveSessionSummary`, or to which sessions are listed.
- The display-name rule itself.

## Further Notes

- The `SeededGame` type is built in many test fixtures. Adding required fields will touch them. A shared fixture default for title, custom name and start time keeps that churn mechanical.
- If the accepted edge (stale quiz title on an ended but still held session) turns out to matter, the fix is to reload held ended sessions' title on a quiz save, not to look the title up again in the controller.
- No `GLOSSARY.md`, `DOCUMENTATION.md` or `/guide` change is needed. Behaviour only changes in that a stats rename reaches the picker straight away.
