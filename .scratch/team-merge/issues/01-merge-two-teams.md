# 01: Merge two teams from the staff team page

**What to build:** staff can merge two teams that are the same real team, from start to finish.

On `/teams/[id]`, "Merge with…" opens a searchable list of every other team. The moderator picks the duplicate, chooses one of the two names, and confirms through a "This can't be undone" step. The moderator then lands on the kept team's page.

- **Who and what is kept:** admin and moderator can merge. The kept team is the newer row: it keeps its token and code, takes the chosen name, and takes the earlier joined date of the two.
- **What moves:** every reference to the duplicate team moves to the kept team, in every table that references a team, the showdown winner included. Then the duplicate is deleted, which frees its name.
- **When it's refused:** the merge re-checks eligibility inside its transaction. It refuses, changing nothing, when:
  - the two teams are the same team, or either doesn't exist
  - the name is neither team's current name
  - any session has rows for both teams in any team table
  - either team took part in a session that hasn't ended, lobby included
- **What the moderator sees on a refusal:** a 409 with the reason, shown inline on the confirm step.

Parent spec: `.scratch/team-merge/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Team-merge module with the merge operation and its eligibility rule (the rule is reused by 02)
- [x] Real-Postgres integration spec, with results checked through existing reads:
  - [x] the team history shows both teams' nights, placings and wins
  - [x] the league table ranks one team with the combined league points
  - [x] the night's team-page detail and session results show the kept team's answers, bonus awards, jokers, ratings, feedback and player counts
  - [x] the showdown winner is repointed
- [x] The kept team has the chosen name (either one), the newer team's code and token, and the earlier joined date. The duplicate is gone, and its name can be used by a new team.
- [x] A join with the newer team's token lands on the kept team
- [x] Every refusal case leaves every row unchanged, including an overlap made only of a stray rating or feedback row, and a kicked team that left answers in a running session
- [x] Merge write on the staff teams controller: Zod body (other-team id, chosen name), 400, 404 and 409, with payload types in shared types. Controller unit spec.
- [x] `/teams/[id]` panel: picker search, name choice, confirm warning, the merge call, navigation to the kept team, and a 409 shown inline. Vitest with mocked fetch.
- [x] `DOCUMENTATION.md` Teams section documents merge, eligibility and which code survives. The `/guide` page gets an "A team forgot its code" tip. `CLAUDE.md` Known Tradeoffs gets "merges aren't recorded or reversible".
