# Spec: One Standings module for participation, ranking and ties

Status: ready-for-agent

## Problem Statement

The quiz master, the teams and whoever reviews results later see different answers to two simple questions: "who took part?" and "who is in which place?". It depends on which screen they look at.

- **The stats list and stats detail disagree on team count.** A kicked team, or one that left mid-session, loses its roster entry but keeps its graded answers and bonuses. Stats detail counts it (commit 872e244 fixed this to stop correct rates going over 100%). The stats list counts only the roster. The same session shows "8 teams" in the list and "9 teams" when opened.
- **A departed team can "win" in stats detail but never in the list.** Stats detail ranks every team that left a mark on the session. The list's winner comes from the roster only. A team kicked for cheating can top the detail standings.
- **Ties are ranked three different ways.**
  - The display leaderboard and the control panel's teams table show competition ranks ("1., 2.–4., 5.").
  - Stats detail numbers teams 1, 2, 3, 4 by list position, so tied teams get different ranks.
  - The stats list names one winner, taken from Postgres name order. Stats detail's first row comes from the browser's name order instead. If a tie for first was never broken, the two views can name different winners.
- **Alphabetical order within a tie can differ between screens.** The live leaderboard and the stats list order tied names with Postgres collation. Stats detail and the teams table re-sort with the browser's locale comparison. The two can disagree on names with accents, capitals or digits, so tied teams can swap places between the display and the control panel.
- **Every new view reinvents the rules.** Participation, ordering and ties have no owner. Four backend and client implementations each carry a comment saying "same ranking as computeLeaderboard". The 872e244 fix changed only one of the two stats queries because nothing tied them together.

## Solution

A single **Standings** module decides who took part, how teams are ordered and how ties are ranked. Every place that shows teams in order reads from it: the live leaderboard (display, control panel, remote, team phones, showdown, leaderboard reveal), the stats list and stats detail.

It has two layers:

- **A pure ranking rule, in shared types.** It takes team totals and returns rows in order, each with a competition rank (1, 2, 2, 4) and its tie group. Backend and frontend both use it. The frontend uses it only for the display's own animations, such as rank-trend arrows against a previous board, and never to re-rank live standings.
- **A backend Standings service.** It loads each team's quiz points and bonus points for one or more sessions under a single participation rule, applies the ranking rule and returns ranked standings.

**Participation rule** (one rule, used everywhere):

- A team **took part** in a session if it is on the session's roster *or* has at least one answer or bonus award in that session.
- A team that took part but is no longer on the roster has **left** (kicked or left on its own). It counts toward team count and toward every stats denominator. It never appears on the live leaderboard, is never ranked and can never win. Stats detail lists it below the ranked teams, marked "left", with no rank.
- A team **on the roster** is ranked from the moment it joins, starting at zero points, so the live standings always include every joined team.

**Ranking rule:**

- Order by total (quiz points + bonus points) descending.
- Teams with equal totals share a competition rank: the rank of the first place in the group. The next group's rank skips past the whole tie.
- Within a tie, teams are listed by name using one comparison defined in the ranking rule, not the database's collation or the browser's locale. The same names therefore order the same way everywhere.

**Winner rule:**

- A session has exactly one winner: the first ranked team.
- A tie for first is broken by the **showdown**. It awards the winning team the showdown's points as a bonus, so that team's total is strictly highest and the ranking rule puts it first on its own. Standings needs no special showdown handling.
- If a session ends with a tie for first still unbroken (no showdown was run, or every showdown ended tied), the winner is the first team in the tie by the ranking rule's name order. The stats list and stats detail therefore always name the same winner.

Clients render the ranks they receive. The control panel's teams table, the display leaderboard and stats detail stop sorting and ranking on their own.

## User Stories

1. As a quiz master, I want the stats list and the stats detail for the same session to show the same team count, so that I trust the numbers I report after an event.
2. As a quiz master, I want a team I kicked to still count toward a session's correct-rate and points-percent denominators, so that no rate ever exceeds 100%.
3. As a quiz master, I want a team I kicked to never appear as the winner of a session anywhere, so that removing a cheating team really removes them from the results.
4. As a quiz master reviewing stats detail, I want departed teams listed below the ranked teams and marked "left", so that I can still see their points without them taking a place.
5. As a quiz master, I want a team that joined but hasn't scored yet to appear on the leaderboard at zero, so that every team at the venue sees itself from the start.
6. As a quiz master, I want a kicked team to vanish from the live leaderboard immediately, so that the big screen never shows a removed team.
7. As a team on the big screen, I want teams with equal points to share a rank (e.g. "2.–4."), so that nobody looks like they beat a team they actually tied.
8. As a team, I want the team after a three-way tie for second to be shown as 5th, not 3rd, so that ranks follow the usual competition convention.
9. As a quiz master, I want the control panel's teams table to show the same ranks and the same order as the big screen, so that I read out exactly what the room sees.
10. As a quiz master reviewing stats detail, I want tied teams to share a rank there too, so that the historical record matches what was shown live.
11. As a quiz master, I want the team that won the showdown to be the session's winner in the stats list and stats detail, so that the tiebreak played at the venue is what the record shows.
12. As a quiz master browsing the stats list, I want the winner-points column to show the winning total, so that the number reflects what actually decided the win.
13. As a quiz master, I want sorting the stats list by winner points to keep working with pagination, so that I can find the highest-scoring sessions across many pages.
14. As a quiz master, I want teams tied on points to appear in the same order on every screen, so that tied teams don't swap places between the display, control panel and stats.
15. As a team with an accented or capitalised name, I want my position within a tie to be the same on every screen, so that the ordering doesn't look arbitrary.
16. As a quiz master running the bottom-up leaderboard reveal, I want each reveal step to uncover one whole tie group, so that the reveal count and the display agree.
17. As a quiz master running a kahoot round, I want the top-five cutoff to keep working from the shared ranks, so that the kahoot leaderboard behaves as it does today.
18. As a quiz master starting a showdown, I want the teams tied for first to come from the same tie groups the display shows, so that the showdown seats exactly the teams the room sees as tied.
19. As a team on a phone, I want the leaderboard overlay to show the same ranks as the big screen, so that my phone and the projector never disagree.
20. As a quiz master using /remote, I want the same ranks as /control, so that switching devices doesn't change the standings.
21. As a quiz master, I want the display's rank-trend arrows to use the same tie rule as the ranks, so that a team that stayed tied isn't shown as having dropped.
22. As a quiz master reconnecting after a network drop, I want the standings in the state snapshot to be already ranked, so that a reconnecting client shows correct ranks without recomputing.
23. As a developer adding a new results view, I want one module to ask for standings, so that I don't have to reinvent participation, ordering or ties.
24. As a developer, I want the ranking rule tested once, table-driven, so that tie behaviour is pinned down in one place.
25. As a developer, I want the participation rule tested against a real database with a kicked team, a team that left, a bonus-only team and a zero-point team, so that the 872e244 class of bug can't reappear in only one of the queries.
26. As a quiz master browsing stats, I want every session to name exactly one winner, even when a tie for first was never broken, so that the stats list and stats detail never disagree about who won.

## Implementation Decisions

- **New Standings module, two layers.**
  - **Ranking rule (shared types, pure).** Input: one entry per ranked team, with team id, name and total. Output: the same entries in final order, each with a 1-based competition `rank` and the last place its tie group spans (`rankTo`, equal to `rank` when not tied). The rule owns the within-tie name comparison. It must not depend on the runtime's locale, so the backend and every browser order the same names the same way.
  - **Standings service (backend).** One read operation takes one or many session ids and returns per session: the ranked teams (roster members) with quiz points, bonus points (net, positive, negative), per-round points and rank; the departed teams with the same points but no rank; the winner; and the participant count (ranked plus departed). It loads everything in a fixed number of queries per call, never one query per session, and pre-aggregates answers and bonuses per team before joining, as the current queries already do, to avoid fan-out.
- **The participation rule lives only in the Standings service.** The stats list's team count, stats detail's team count and denominators, and the live leaderboard's roster all come from it. The union query added in 872e244 moves into the service. The list's separate roster-only team count and winner subqueries are removed.
- **Live leaderboard reads Standings.** The answer service's leaderboard computation is replaced by, or delegates entirely to, the Standings service. Its callers (grading, bonus, admin actions, block grading, game state) are unchanged apart from where they call. Refreshing the cached leaderboard when a team joins, leaves or is kicked is part of this work, so zero-point roster teams and removals show up at once.
- **`LeaderboardEntry` gains rank fields.** Each entry carries `rank` and `rankTo` from the ranking rule, and the snapshot's leaderboard is already in final order. Clients render the label ("1.", "2.–4.") from these fields and no longer group ties themselves.
- **Shared leaderboard helpers use tie groups.** The reveal step count, the tied-for-first lookup (showdown) and the kahoot top-N cutoff read `rank` and `rankTo` instead of re-scanning for equal `totalPoints`. The top-N cutoff keeps its current "split a tie at the cutoff" behaviour.
- **Stats detail uses Standings.** The pure session-detail calculation receives standings and the participant count instead of computing ranks. `SessionDetailStandingRow.rank` becomes nullable: null for a departed team. The row also gets a `hasLeft` flag. Departed rows come after all ranked rows. Correct-rate and points-percent denominators use the participant count.
- **Standings names one winner.** Each session's standings carry a single `winner`: the first ranked team, or none when no team is ranked. A showdown resolves a tie for first through its bonus award. An unbroken tie falls back to the ranking rule's name order. Stats detail marks that row as the winner, so a winner is shown even when its rank is shared.
- **Stats list uses Standings.** The list keeps a single `winnerTeamName`, taken from the Standings winner. `winnerAnswerPoints` becomes `winnerPoints`, the winning total including bonus (and so including any showdown bonus). The winning total is the same whichever tied team is named, so sorting on it needs no tie rule in SQL. `teamCount` becomes the participant count. Sorting by winner uses the session's maximum ranked total, which doesn't depend on tie order, so pagination and sorting stay in SQL. The Standings service then fills in winner names only for the returned page.
- **Client re-sorting is deleted.** The control panel's teams table stops merging, zero-filling and sorting and renders the snapshot's leaderboard in the order given. The display leaderboard renders the ranks it receives. It still uses the shared ranking rule on its previous board to work out trend arrows and reveal animations, so the animations follow the same tie rule without re-ranking live data.
- **No schema changes.** Participation is derived from the roster, answers and bonus awards as today. No migration.

## Testing Decisions

- **A good test asserts only external behaviour.** Give standings inputs (or seed a real database), call the public operation, and assert the ranked rows, ranks, departed rows and counts. Don't assert which queries ran, how many, or any intermediate structure.
- **Seam 1: the ranking rule, table-driven, in shared types.** Cases: no teams; a single team; the winner when first place is clear and when it's tied (the name-order fallback); all teams tied, including everyone on zero; a tie for first; a three-way tie in the middle (the next team is ranked after the whole tie); a tie at the bottom; negative totals from penalties; names that differ only in case, accents or digits, ordered the same regardless of locale. Prior art: the existing leaderboard tiebreak helpers in shared types and the frontend's leaderboard rank tests.
- **Seam 2: the Standings service against real Postgres (testcontainers).** Seed one session with a roster team with no answers, a team with answers only, a team with bonus only, a kicked team with graded answers, a team that left with a bonus, two teams tied on total, and a second session where two tied teams played a showdown and one won it. Assert the showdown winner is the session's single winner. Also assert ranked rows, departed rows, participant count and per-round points. Add a multi-session call to show that sessions don't mix. Prior art: the Postgres integration suite for the stats service and the answer service's leaderboard spec.
- **Existing consumer tests are updated, not duplicated.** Stats list and detail tests assert the new payload fields (`winnerPoints`, nullable `rank`, `hasLeft`, participant-based `teamCount`, detail's winner marker), including a showdown-resolved tie, an unbroken tie for first (both views name the same winner) and a kicked high scorer. The session-detail calculation spec stops asserting rank assignment and asserts that given standings pass through with the right denominators. Frontend teams-table, display-leaderboard and leaderboard-overlay tests feed pre-ranked entries and assert the rendered labels. Showdown and reveal-count tests use ranked leaderboards.
- **No new seams beyond these two.** Gateway, handler and page behaviour is covered by the existing tests once they receive ranked standings.

## Out of Scope

- Who owns refreshing cached derived state and which rooms get pushed after a change. That belongs to the Live session module (`.scratch/live-session-module/`). This spec only requires that standings are refreshed when a team joins, leaves or is kicked, through whatever refresh path exists when it lands.
- The per-answer verdict and what "correct" means for correct counts. That belongs to the Scoring module (`.scratch/scoring-module/`). Correct counts in stats detail keep whatever definition that module settles on.
- Tie-breaks other than the showdown and the name-order fallback, such as fewer penalties or fastest average response. Changing how the showdown works, e.g. requiring one before the quiz can end.
- A league or cross-session leaderboard (see the league roadmap). It would be a natural second consumer of the Standings service but isn't built here.
- Changing how per-round points are attributed after a mid-game quiz re-import.

## Further Notes

- Source: candidate 04 ("One Standings module") of the architecture review dated 2026-09-30, at `7b3c1da`.
- No ADR covers this area. ADR-0001 (free text excluded from kahoot rounds) is unrelated.
- **Deliberate user-visible changes worth checking at review:**
  - The stats list's winner-points column shows the winning total including bonus (including any showdown bonus) instead of answer points only.
  - Stats detail ranks ties as shared ranks and moves departed teams to an unranked "left" section.
  - The stats list's team count now includes departed teams, so it matches stats detail.
- Ordering within a tie will change for some names on screens that used Postgres collation. That's expected: one rule replaces two.
- Suggested order: ranking rule, then the Standings service, then the live leaderboard, then stats detail, then the stats list, then deleting client re-sorts. Each step can ship on its own.
