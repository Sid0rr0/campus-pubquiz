# Spec: The control panel's teams table reads rounds from the snapshot

Status: ready-for-agent

Blocked by: none.

Source: architecture review 2026-10-20, "Out of Scope, revisited", candidate 5. `props-refactor` deferred this item.

## Problem Statement

The teams table on `/control` shows one points column per round. It builds those columns from two sources that can disagree:

- **The round list comes from the REST quiz list**, the active quiz's rounds as last fetched over HTTP. The admin view already carries `roundTitles` for exactly this table, and it is ignored here. The REST list is refetched on its own schedule, so after a live edit adds or removes a later round, the table can show the old number of columns until the next fetch. On a fresh load, it shows no round columns at all until the list arrives.
- **A team's points for a column are found by matching the round's title** against the titles in the team's `roundPoints`. A quiz can have two rounds with the same title (say "Music" twice, or two untitled rounds). Then both columns show the first round's points, and the second round's points appear nowhere in the table. The total is right, but the per-round columns don't add up to it.

The quiz master uses this table during a break to check scores and settle disputes. A column that shows another round's points, or a missing column, makes the scores look wrong at the moment someone is checking them.

## Solution

The teams table takes its rounds from the admin view it is sent: one column per entry of `roundTitles`, in round order. Each column shows the team's points for that round by position in `roundPoints`, which the server already sends in round order, never by title. The REST quiz list no longer feeds the table.

For the quiz master, the columns appear with the first snapshot, follow a live edit as soon as the server sends it, and two rounds with the same title each show their own points.

## User Stories

1. As a quiz master, I want one points column per round of the quiz on air, so that I can see how each team did round by round.
2. As a quiz master, I want each column to show the points from its own round even when two rounds share a title, so that the columns add up to the total.
3. As a quiz master, I want the round columns to be there as soon as `/control` connects, so that I don't see a table without them while the quiz list loads.
4. As a quiz master, I want a round added to or removed from the unplayed part of the quiz during the night to show in the table as soon as the server sends the edit, so that the table matches the quiz on the big screen.
5. As a quiz master, I want a round nobody has scored in yet to show 0 for every team, so that an empty column isn't mistaken for missing data.
6. As a quiz master, I want a reconnected `/control` to show the same columns as before the drop, so that a Wi-Fi blip doesn't change the table.
7. As a quiz master, I want sorting by a round column to sort by that round's points, so that I can find who won a round.
8. As a quiz master, I want the round column headers to stay numbered 1, 2, 3…, so that the table stays as compact as it is today.
9. As a developer, I want the table to read one source for which rounds exist and one for each team's points, so that the two can't disagree.
10. As a developer, I want no column lookup to depend on a round title, so that renaming a round, or a quiz with repeated titles, can't move points between columns.

## Implementation Decisions

- **Teams table input.** The table keeps its round-titles input, but `/control` now fills it from the admin view's `roundTitles` (already sent to the display and admin rooms, and documented as "used by … /control's score table"), not from the REST quiz list. The REST quiz list still feeds the question browser and the quiz title. Neither is in scope.
- **Points by round position.** A column at round index `i` shows `roundPoints[i].points`, or 0 when the entry is missing. The title-matching helper is deleted. This is the same by-index read the leaderboard board already uses for "total before this round".
- **Why index matching is safe:**
  - The server builds `roundPoints` from the session's rounds in round order, and `roundTitles` from the seeded game's rounds in the same order.
  - A live edit reloads the seeded game straight away, while `roundPoints` only refreshes with the next standings refresh. ADR 0002 lets live structural edits touch only the unplayed part of the quiz, so every round a team has scored in keeps its index. A round added or removed later in the quiz has 0 points either way.
  - The missing-entry fallback to 0 covers the brief window where `roundTitles` is longer than a stale `roundPoints`.
- **No protocol or backend change.** `RoundPoints` keeps its `roundTitle` field, because other consumers (stats, session result, leaderboard tests) read it. This spec only stops the teams table matching on it.
- **Docs.** Nothing in `GLOSSARY.md` or `DOCUMENTATION.md` describes the matching. The `/guide` page's teams table wording needs no change, because the table looks the same.

## Testing Decisions

- A good test renders what the quiz master sees, a column per round with each team's points, from the view `/control` is sent. It never checks which helper looked a value up.
- **Primary seam: the `/control` page test** with `useAdminGame` returning a `roomView` admin view and the quiz list API mocked. Prior art: the status-and-teams test and the control test utils.
  - The round columns appear from the view's round titles while the quiz list is still empty or unresolved.
  - When the quiz list disagrees with the view (a stale extra or missing round), the table follows the view.
- **Component tests on the teams table** (existing teams-table test):
  - two rounds with the same title each show their own points
  - a round with no `roundPoints` entry shows 0
  - sorting by a round column sorts by that round's points

  The existing cases pass, with fixtures still in round order.

## Out of Scope

- Feeding the question browser from the snapshot instead of the REST quiz list. It needs each round's questions, which the admin view doesn't carry.
- Refreshing standings as part of a live quiz edit.
- Showing round titles in the column headers or tooltips.
- Removing `roundTitle` from `RoundPoints`.

## Further Notes

- The same title-matching pattern appears nowhere else in the frontend: a search for `roundPoints` consumers finds only the teams table and the leaderboard board, which already reads by index.
