# Spec: Player counts and a team stats page

Status: done

Blocked by: —

## Problem Statement

The quiz master doesn't know how many people actually came to a quiz night. The roster says how many teams joined, but a team might be two friends or eight. That makes it hard to answer simple questions afterwards: how big was the crowd, are teams getting bigger, did the room fill up? The house rules already say "Max 6 players per team", but nothing records how many players a team really had, so nobody can see who went over.

The stats pages are also built around sessions only. There's a directory of teams with a "Sessions played" count, but nowhere to see how one team has done over the season: how often it wins, where it usually finishes, how many points it scores, or how many players it usually brings.

## Solution

When a team joins a session, its phone asks "How many players are you?" on the lobby screen. Answering is optional and the number can be changed later from the phone's settings. A team that joins after the quiz has started gets the same question once, as a card it can dismiss. The quiz master sees each team's **player count** on the `/control` Teams panel, can correct it, and sees a flag on teams over the house-rules cap. No penalty is applied automatically.

Session stats gain total players, average team size and a Players column. A new team stats page at `/teams/[id]` shows one team's history across every ended session it played: wins, podiums, best and **average placing**, average share of the max points, average total points, average player count, and a table of its sessions. The `/teams` directory gains a sortable Avg. placing column, and team names in the directory and in a session's standings link to the team page.

Terms used throughout (see `GLOSSARY.md`): **Player count**, **Placing**, **Average placing**.

## User Stories

### Teams reporting their player count

1. As a team, I want my phone to ask how many players we are right after we join, so that I can tell the quiz master without anyone walking round with a clipboard.
2. As a team, I want to pick the number with a stepper (− / +), so that entering it on a phone is quick and can't produce typos.
3. As a team, I want to skip the question, so that I'm never blocked from playing by a stats field.
4. As a team, I want to see "Saved ✓" after I send the count and a retry option if it failed, so that I know the quiz master got it.
5. As a team, I want the lobby screen to keep showing "Look for (team name) on the big screen" and the rules link alongside the question, so that nothing I rely on today disappears.
6. As a team that joins after the quiz has started, I want to be asked once as a card I can dismiss, so that I can still report our count without missing a question.
7. As a team that has already given its count, I don't want to be asked again after a reconnect or a page refresh, so that the prompt doesn't nag me.
8. As a team whose friend arrives late or leaves early, I want to change our count from the phone's settings at any point in the session, so that the number stays right.
9. As a team playing on two phones, I want both phones to show the same count, and a change on one to appear on the other, so that we don't report two different numbers.
10. As a team that gets kicked and rejoins with its team code, I want our earlier count to still be there, so that I don't have to enter it again.
11. As a team, I want a count outside 1–20 or a non-whole number refused, so that a mistake doesn't end up in the stats.
12. As a team, I want reporting our count never to cost us points, so that I can answer honestly even if we're over the cap.

### The quiz master on `/control`

13. As a quiz master, I want to see each team's player count in the Teams panel, so that I know how big the room is during the night.
14. As a quiz master, I want a team over the session's "max players per team" setting to be flagged in the Teams panel, so that I can decide whether to give the house-rules penalty as a bonus award.
15. As a quiz master, I want to see "—" for a team that hasn't given a count, so that I can ask them in person.
16. As a quiz master or moderator, I want to set or correct a team's count from the Teams panel, so that I can fix a typo or enter it for a team that skipped.
17. As a quiz master, I want my correction to appear on the team's phones, so that the team and I agree on the number.
18. As a quiz master, I want to be able to edit the count at any point in the session, in the lobby or later, so that late arrivals can be counted.
19. As a quiz master, I want the big screen to stay exactly as it is, so that the lobby roster isn't cluttered with numbers.

### Session stats

20. As a quiz master, I want an ended session's stats page to show the total number of players, so that I know how many people came.
21. As a quiz master, I want it to show the average team size, so that I can see whether teams are getting bigger or smaller.
22. As a quiz master, I want the total and average to leave out teams with no count rather than count them as zero, so that skipped answers don't drag the numbers down.
23. As a quiz master, I want to see how many teams gave a count next to the total, so that I know how complete the number is.
24. As a quiz master, I want a Players column in the session's standings table, so that I can see each team's count beside its result.
25. As a quiz master, I want a team that was kicked or left to still show its count and still add to the total, so that the numbers reflect who actually played.
26. As a quiz master, I want a Players column on the played-sessions list, so that I can compare crowd sizes across nights at a glance.
27. As a quiz master, I want sessions played before this feature to show "—" for players, so that old data isn't presented as zero.

### Team stats page

28. As a quiz master, I want to open a team's stats page from the `/teams` directory, so that I can look up any team.
29. As a quiz master, I want to open a team's stats page from a session's standings table, so that I can go from one night's result to the team's history.
30. As a quiz master, I want the page to show how many ended sessions the team played, so that I know how regular it is.
31. As a quiz master, I want to see how many sessions the team won and how many times it finished top three, so that I can spot the strong teams.
32. As a quiz master, I want to see the team's best placing and its average placing, so that I know how it usually does.
33. As a quiz master, I want to see the team's average share of the max points, so that I can compare its performance across quizzes of different lengths.
34. As a quiz master, I want to see the team's average total points next to that, so that I also have the raw number.
35. As a quiz master, I want to see the team's average player count, so that I know how many people it usually brings.
36. As a quiz master, I want a table of the team's sessions, newest first, with date, session name, placing ("4th of 12", "Joint 2nd"), total points, share of max points, correct answers and player count, so that I can see its whole history.
37. As a quiz master, I want each session in that table to link to its stats page, so that I can dig into one night.
38. As a quiz master, I want sessions the team left (kicked or left on its own) to appear in the table marked "left", so that its history is complete.
39. As a quiz master, I want those "left" sessions excluded from wins, podiums, best placing and average placing, so that a team that left early isn't scored as last.
40. As a quiz master, I want only ended sessions counted, so that a session still in progress or never finished doesn't distort the figures.
41. As a quiz master, I want the table sortable and paginated like the other stats tables, so that a team with many sessions is still easy to read.
42. As a quiz master, I want a team with no ended sessions to see a clear empty state rather than zeros, so that I don't misread the page.
43. As a quiz master, I want a clear "not found" message for a team id that doesn't exist, so that a bad link doesn't show a broken page.
44. As a team, I want our round ratings, comments and topic suggestions never to appear on our team page, so that feedback stays anonymous.
45. As a quiz master, I want the team code to stay behind the existing "Show team code" action rather than on the team page, so that it isn't on screen by accident.
46. As a moderator, I want the same access to team pages as to the rest of stats, so that I can use them too.

### Teams directory

47. As a quiz master, I want an Avg. placing column on the `/teams` directory, so that I can compare teams without opening each one.
48. As a quiz master, I want to sort the directory by Avg. placing, so that I can find the strongest teams.
49. As a quiz master, I want teams with no placing to show "—" and sort last whichever way I sort, so that teams without a placing don't crowd the top.
50. As a quiz master, I want team names in the directory to link to the team page, so that I can get from the list to the details in one click.

## Implementation Decisions

### Domain and storage

- **Player count** is one whole number from 1 to 20 per team per session, or unknown. It's stored in a new per-team, per-session table, unique on (session, team), with cascade deletes from both. It is **not** a column on the roster join table, because a kick deletes the roster row and the count must survive a kick and rejoin. The feedback table follows the same pattern.
- Writing a count is last-write-wins, replacing the earlier value. No history is kept, so stats read only the final value.
- No migration backfill: earlier sessions simply have no counts.
- The count never touches scoring. The session settings' max players per team and extra player penalty stay display text. The only new use of the cap is the over-cap flag on `/control`.

### Socket protocol

- New client → server event from the phone, `SET_PLAYER_COUNT`, with payload `{ playerCount: number }`. It's validated by a Zod schema in the socket payload schemas (a whole number, 1–20) and answered with the usual ack.
  - It's allowed for a linked team in any status except after the session is closed. It's refused for a socket without a team link.
  - It goes through the Session write like every other live change, declaring that it doesn't change scores so the standings read is skipped.
- New admin event, `SET_TEAM_PLAYER_COUNT`, with payload `{ teamId: number, playerCount: number }`. It's admin-room gated like `KICK_TEAM`, allowed for admins and moderators, and uses the same validation. It's refused for a team that has never been on this session's roster.
- Clearing a count back to unknown isn't supported. Once given, it can only be changed.
- The team's count travels with the **team link**:
  - The join-accepted payload carries the team's `playerCount` (`number | null`), so a reconnect, a second phone or a rejoin after a kick gets it.
  - After any change, from the team or the admin, every phone of that team receives it through the existing per-team sync path (the same one that carries the team's answers and ratings), never through the room-wide players view. One team's count never reaches another team.
- The admin view's team roster entries gain `playerCount: number | null` and `isOverPlayerCap: boolean`. The flag is true when the count exceeds the session's max players per team. The flag is worked out server-side so `/control` doesn't repeat the rule.
- The display view is unchanged.

### Phone (`/play`)

- The lobby phone screen keeps its current content and adds a player count card: a stepper and a Send button with "Saved ✓" and retry states. The card is shown when the team link has no count. Once a count is saved it collapses to a "(n) players · edit" line.
- A team that joins after the lobby, with no count, sees the same card once over whatever screen it lands on, with a dismiss control. Dismissing is remembered on that phone (localStorage, wrapped in try/catch) so it doesn't come back. Reconnects with a count never show it.
- The settings modal gains a player count field with the same stepper, so the count can be changed at any time.

### `/control`

- The Teams panel shows each team's count ("—" when unknown) with an over-cap flag, and an edit control that sends `SET_TEAM_PLAYER_COUNT`.

### Stats API (REST, admin and moderator, same guards as today's stats)

- The session detail response gains:
  - `playerCount: { total: number; average: number | null; reportedTeams: number }`. The total sums known counts across every participant, departed teams included. The average is total ÷ reportedTeams, null when no team reported.
  - `playerCount: number | null` on each standing row, departed rows included.
- The played-sessions list items gain `totalPlayers: number | null`, null when no team in the session reported.
- New endpoint: team detail for one team id, returning a 404 for an unknown team:
  - header: team id and name
  - summary:
    - sessions played (ended sessions where the team took part, including ones it left)
    - wins (placing 1 and the session's single winner, matching the standings "winner")
    - podiums (placing 1–3)
    - best placing
    - average placing (to one decimal, null when no placing)
    - average share of max points (mean over played sessions of total ÷ the session's max points, as a percentage)
    - average total points
    - average player count (over sessions with a known count, null when none)
  - sessions: one row per ended session, newest first: session id, name, played at, placing and placing-to (null when left), team count, `hasLeft`, total points, max points, correct answers, player count.
- Placing and departed-team handling come from the existing Standings service per session, so the team page agrees exactly with each session's standings table. Ties share the competition rank. Kicked and left teams have no placing.
- The teams directory list items gain `averagePlacing: number | null`, and the directory's sort columns gain average placing. Sorting puts nulls last in both directions.
- The team detail response must not carry any feedback (ratings, comments, topics) or the team code.

### Frontend pages

- New route `/teams/[id]` with highlight tiles and a sessions table, reusing the existing sortable table and highlight tile components from the stats pages. It handles empty and not-found states.
- Team names in the `/teams` directory and in the `/stats/[id]` standings table link to `/teams/[id]`.
- `/stats/[id]` gains the Total players and Avg. team size tiles (the total tile notes "n of m teams reported") and a Players column. `/stats` gains a Players column.

### Docs (same commits as the code)

- `GLOSSARY.md`: Player count, Placing and Average placing were added during design.
- `DOCUMENTATION.md`: the new socket events and payload fields, the stats and team detail API, the `/teams/[id]` route in the routes table.
- `/guide`: the player count and over-cap flag on the `/control` Teams panel, and how to correct it.

## Testing Decisions

- **A good test checks only what clients receive or what the API returns.** Drive real sockets or call the real service, then check payloads: acks, the join-accepted payload, team syncs, the admin view, the stats and team detail responses, the rendered UI. Don't check repository calls, table rows or helper internals.
- **Seam 1, the real-database game gateway harness** (testcontainers):
  - A team sets its count: ok ack, and the team's other connected phone receives the new count. Another team's phone never does.
  - Setting it again keeps the last value, and a reconnect's join-accepted payload carries it.
  - Kick, then rejoin with the team code: the join-accepted payload still carries the count.
  - The admin sets a team's count: the team's phones receive it, and the admin view's roster entry shows it.
  - The admin view's `isOverPlayerCap` is true above the session's max players per team and false at or below it.
  - Validation: 0, 21, 2.5 and a string are refused. A socket with no team link is refused. `SET_TEAM_PLAYER_COUNT` from a non-admin socket is refused, and so is one for a team never on the roster.
  - It works in the lobby and mid-quiz alike. The display view doesn't change.
  - Prior art: `join-players.spec.ts` and `team-answers-sync.spec.ts` for the join payload and team syncs, `ack.spec.ts` and `socket-payload-validation.spec.ts` for acks and validation, the kick specs for kick and rejoin, and the feedback gateway specs for a team-sent last-write-wins value.
- **Seam 2, the stats and team services against real Postgres** (`stats.service.spec.ts`, `team.service.spec.ts` style):
  - Session detail: total and average leave out unknown counts, reportedTeams is right, a departed team's count is included, the average is null when nobody reported, and each standing row carries its count.
  - The played-sessions list's totalPlayers, null when nobody reported.
  - Team detail:
    - only ended sessions count
    - a left session is listed with `hasLeft` but excluded from wins, podiums, best and average placing
    - a tie counts at its shared placing
    - share of max points is averaged per session, not pooled
    - average player count leaves out unknown counts
    - a team with no sessions gives empty sessions and null averages
    - an unknown team gives a 404
    - the response contains no feedback and no team code
  - Directory: averagePlacing is correct, and sorting by it puts nulls last both ways.
  - The controller rejects bad ids and queries, in the `stats.controller.spec.ts` and `teams.controller.spec.ts` style.
- **Seam 3, frontend component tests** (Vitest and Testing Library), fed with server-shaped data:
  - Lobby card: the stepper is clamped to 1–20, Send shows "Saved ✓" on an ok ack and a retry on an error, and it collapses to "(n) players · edit" once saved.
  - The late-joiner card shows once, dismisses, and doesn't show when a count exists.
  - Settings modal field.
  - `/control` Teams panel: shows the count and "—", the over-cap flag, and the edit control sends the event.
  - `/stats/[id]`: tiles and Players column with "—". `/stats`: the Players column.
  - `/teams/[id]`: tiles, the sessions table with "left" rows and "Joint 2nd", and the empty and not-found states.
  - `/teams`: the Avg. placing column with "—", and team names link to the team page.
  - Prior art: `play/__tests__/pre-game-screens.test.tsx` and `join-and-reconnect.test.tsx`, `stats/[id]/__tests__/session-detail-panel.test.tsx` and `standings-table.test.tsx`, `stats/__tests__/played-sessions-panel.test.tsx`, `teams/__tests__/`.
- Existing specs stay green. The join-accepted payload, admin view, session detail and team list items gain fields, so any strict-equality test on them needs a mechanical update.
- No new E2E journey.

## Out of Scope

- Applying the extra-player penalty automatically. The quiz master still gives it as a bonus award if they choose.
- Enforcing the max players per team cap in any way beyond the `/control` flag.
- Showing player counts on the big screen.
- Making the player count required, or blocking the phone until it's given.
- Clearing a player count back to unknown once given.
- A history of player count changes within a session.
- Showing a team's feedback (round ratings, comments, topics) on the team page or anywhere attributed. Feedback stays anonymous.
- Charts or trend lines on the team page.
- Points per player or any per-player scoring figure.
- A league or season leaderboard, or season boundaries. The team page covers all ended sessions.
- Percentile-based placing. Average placing is the raw mean.
- Team pages for teams themselves (from the phone). The page is for staff.

## Further Notes

- **Q19 default:** the design session ended before "placing vs position" was answered, so this spec uses the recommended **placing** everywhere, labels included ("Avg. placing"). If "position" is preferred on screen, only the UI labels change. The domain term stays Placing.
- Feedback anonymity was explicitly reaffirmed while designing this feature. Don't add team-attributed feedback to the team detail response even though the data could be joined.
- The over-cap flag compares against the session's own max players per team setting, so changing that setting in the lobby changes the flag.
- The phone, `/control` and every stats page must agree on who placed where. Always derive placings from the Standings service rather than recomputing ranks in SQL.
