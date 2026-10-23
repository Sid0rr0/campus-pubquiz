# Spec: Merge two teams that are the same real team

Status: ready-for-agent

Blocked by: —

## Problem Statement

A team that forgets its team code can't rejoin under its own name. If it joins a later night under a slightly different name ("Quizzly Bearz" instead of "Quizzly Bears"), the app creates a new team, and the team's history is now split across two teams. The team directory lists it twice. The team page shows only half its nights. The league ranks two half-teams instead of one. Staff have no way to fix this: the staff team pages are read-only.

## Solution

Staff can **merge** two teams from the staff team page (`/teams/[id]`). They choose the other team from a searchable list, pick which of the two names is correct, and confirm. The **kept team** carries on with both teams' sessions. The **duplicate team** stops existing. The code and phone sign-in carry over from the newer of the two teams, so the phones the team plays on now stay signed in. The confirm step shows the kept team's code, so staff can read it out to the team.

The merge is refused in two cases:

- both teams took part in the same session, since a team can't have two placings in one night
- either team took part in a session that hasn't ended, lobby included

A merge can't be undone.

## User Stories

1. As a moderator, I want to merge two teams that are the same real team, so that their history is in one place.
2. As an admin, I want the same merge, so that either staff role can fix duplicates.
3. As a moderator, I want to start the merge from a team's staff page, so that I can fix a duplicate where I spot it.
4. As a moderator, I want to search the other teams by name, so that I can find the duplicate among many teams.
5. As a moderator, I want teams that can't be merged to stay in the list, greyed out with the reason, so that I understand why a merge isn't offered instead of thinking the team is missing.
6. As a moderator, I want to see "both took part in <session>" when the two teams played the same night, so that I know this pair can't be merged.
7. As a moderator, I want to see "<team> is in a session that hasn't ended" when either team is in tonight's session, so that I know to come back after the night.
8. As a moderator, I want a team kicked from a running session to count as being in it if it left answers or bonus awards behind, so that a merge never rewrites a live night.
9. As a moderator, I want to pick which of the two names the kept team uses, so that the team keeps the name it really goes by.
10. As a moderator, I want only the two existing names on offer, so that a merge never doubles as a rename.
11. As a moderator, I want the confirm step to show both teams with their sessions played, so that I can check they really are the same team.
12. As a moderator, I want the confirm step to show the combined result (name, sessions played, the code that carries over), so that I know what will happen.
13. As a moderator, I want the confirm step to show the kept team's code, so that I can read it out to the team that lost it.
14. As a moderator, I want a clear "This can't be undone" warning, so that I don't merge by accident.
15. As a moderator, I want to land on the kept team's staff page after merging, so that I can see the merged history right away.
16. As a moderator, I want the duplicate team's old staff page to say the team doesn't exist, so that stale links don't show stale data.
17. As a team, I want the phones we play on now to stay signed in after the merge, so that we don't have to rejoin.
18. As a team, I want our team code to be the newer team's code, so that the code staff tell us matches what our phones hold.
19. As a team, I want our team page to show every night from both teams, so that our whole history is in one place.
20. As a team, I want our placings, wins, podiums and average placing to cover both teams' nights, so that our stats are right.
21. As a team, I want each night's questions on our team page to show the answers we gave that night, whichever team we played as, so that nothing goes missing.
22. As a team, I want the league table to rank us once with the league points from both teams' nights, so that our league position is fair.
23. As a team, I want our bonus awards, jokers, player counts, round ratings, feedback and showdown entries to move with us, so that every night stays complete.
24. As a team that won a showdown under the duplicate name, I want the kept team shown as the winner, so that the result isn't lost.
25. As a moderator, I want the team directory to list the kept team once, so that duplicates disappear.
26. As a moderator, I want the kept team's "joined" date to be the earlier of the two, so that the directory shows when the team first played.
27. As a moderator, I want the duplicate's name to be free after the merge, so that another team can use it.
28. As a moderator, I want to merge three or more duplicates one pair at a time, so that I can fix a team that changed its name more than once.
29. As a staff member reading the stats page or a night brief of an earlier night, I want it to show the kept team, so that every page agrees.
30. As a moderator, I want to be told if the other team was deleted or changed while I was confirming, so that I never merge stale data.
31. As a moderator, I want a merge refused for a team with itself, so that a mistaken pick does nothing.
32. As a moderator running a quiz night, I want the guide to tell me what to do when a team forgot its code, so that I don't need to ask anyone.

## Implementation Decisions

- **Terms:** use **Merge**, **kept team** and **duplicate team** as defined in the glossary (Team link section). Use **took part** as the glossary defines it.
- **New team-merge module** in the backend team module. It has two operations, and both use the same eligibility rule:
  - **Preview for a team:** every other team with its name, its sessions played, and either `mergeable` or a refusal reason. A reason is one of two kinds:
    - `shared_session`: the clashing session's name, or every clashing session's name
    - `unended_session`: which team is in it
  - **Preview for a pair:** both teams' sessions played, the combined sessions played, the newer team (whose code carries over) and its code.
  - **Merge (team A, team B, chosen name):** re-checks eligibility inside the transaction, then performs the merge.
- **Which team is kept:** the newer team's row is kept, the one created later. It keeps its id, token and code, takes the chosen name, and takes the earlier creation time of the two (the directory's "joined"). The duplicate is the older row.
- **Eligibility (refuse unless all hold):**
  - the two teams are distinct and both exist
  - no session has rows for both teams in any table that references a team, not just the took-part tables. This covers roster, answers, bonus awards, feedback, round ratings, jokers, player counts, showdown teams and the showdown winner. Checking every table stops a uniqueness constraint failing partway through the merge.
  - neither team took part in a session whose status isn't `ended`, lobby included
- **The merge itself, in one transaction:**
  1. Repoint every reference to the duplicate team to the kept team, in every table that references a team, including the nullable showdown winner.
  2. Delete the duplicate.
  3. Set the kept team's name to the chosen name. The order matters: names are unique, so the duplicate must be gone before the kept team can take the duplicate's name.

  Nothing about the merge itself is stored.
- **Live state is never touched:** the eligibility rule makes sure neither team is in a running session's state, its seats or its phase timers. That's why a merge doesn't go through the session write.
- **Derived reads need no change:** standings, session results, the team history, the team page, the league table and the stats page all compute from the rows. They show the merged team as soon as the rows are repointed. Don't cache or copy anything.
- **REST contract** on the existing staff teams controller (admin and moderator, same guards):
  - a merge-preview read for a team, with an optional other-team id for the pair preview
  - a merge write with a body of other-team id and chosen name, which returns the kept team's id
  - The body is validated with Zod, and the chosen name must equal one of the two teams' current names.
  - Refusals are 409 with the reason. An unknown team is 404.
  - Payload types live in shared types beside the existing team types.
- **Phones after a merge:** a rejoin looks up the token first. A phone holding the newer team's token rejoins as the kept team and receives its current name. A phone holding only the older team's token was already signed out in practice, so it falls back to name and code like any phone.
- **Frontend (`/teams/[id]`):**
  - a "Merge with…" action opens a searchable picker over the preview list, with refusals greyed out and their reason
  - picking a mergeable team shows the confirm step: both teams with their sessions played, a radio choice of the two names, "Code and phones carry over from <newer team>", the kept team's code, the combined sessions played, and "This can't be undone"
  - confirming merges, then navigates to the kept team's page
- **Docs in the same change:**
  - `DOCUMENTATION.md` Teams section: merge, eligibility, which code survives
  - a short "A team forgot its code" tip on the `/guide` page: rejoin with name and code from `/teams/[id]` on the night, or merge after the night ends
  - a one-line Known Tradeoff in `CLAUDE.md`: merges aren't recorded or reversible

## Testing Decisions

- Good tests check external behaviour through the highest seam: call the merge, then look at the results through the reads that already exist. Don't assert on which rows moved or in what order.
- **Team-merge module (main seam):** a Postgres integration spec on the real test database. Prior art: the team-history service spec and its builders for ended sessions and standings. Cases:
  - after a merge, the team history shows both teams' nights, placings and wins
  - the league table ranks one team with the combined league points
  - a session's answers, bonus awards, jokers, ratings, feedback and player counts belong to the kept team, as seen through the night's team-page detail and session results
  - the showdown winner is repointed
  - the kept team has the chosen name (either one), the newer team's code and token, and the earlier joined date
  - the duplicate no longer exists, and its name can be used by a new team
  - a join with the newer team's token lands on the kept team (through the team service join)
  - refusal when both teams took part in one session, including a session where the only overlap is a stray rating or feedback row
  - refusal when either team took part in a session that hasn't ended: lobby, running, and kicked but with answers left in a running session
  - refusal for the same team twice, an unknown team, or a name that's neither team's
  - a refused merge changes nothing
  - the preview marks the same pairs mergeable or refused, with the same reasons, as the merge
- **Teams controller:** unit spec with mocked services, like the existing teams controller spec. Covers Zod validation (400), refusal → 409, unknown → 404, and delegation.
- **`/teams/[id]` panel:** Vitest with mocked fetch, like the existing team detail panel test. Covers picker search, greyed-out reasons, name choice, confirm content (including the code), merge call and navigation, and a 409 shown inline.
- No E2E journey: nothing live or real-time changes.

## Out of Scope

- Merging two teams that took part in the same session (two phones of one team under two names on one night), and any rules for resolving clashing answers.
- Merging while either team is in a session that hasn't ended, including from `/control`.
- Renaming a team, or typing a new name during a merge.
- Undoing a merge, or any audit record of merges (who, when, the old name).
- Suggesting likely duplicates (similar names).
- Freezing league tables of past leagues against a merge.
- Keeping the older team's code or token.

## Further Notes

- Leagues are computed from sessions, not stored per team. A merge can shift positions in a league that's already over. That's accepted: the merged history is the true one.
- The duplicate's old staff page URL becomes a 404, which is fine at this scale.
