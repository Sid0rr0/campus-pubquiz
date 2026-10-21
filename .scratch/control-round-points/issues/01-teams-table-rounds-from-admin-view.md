# 01: The teams table reads its rounds and points from the admin view

**What to build:** On `/control`, the teams table shows one points column per round of the quiz on air, taken from the admin view's `roundTitles`, not from the REST quiz list. Each column shows the team's points for that round by round position in the team's `roundPoints`, which the server already sends in round order, and 0 when there is no entry. Columns no longer match on round titles, so two rounds with the same title each show their own points. The columns are there from the first snapshot and follow a live edit as soon as the server sends it. The REST quiz list still feeds the question browser and the quiz title. Headers stay numbered 1, 2, 3…. No protocol or backend change. See the spec's Implementation Decisions for why matching by index is safe under ADR 0002.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] `/control` passes the admin view's `roundTitles` to the teams table. The REST quiz list isn't used for the table's columns.
- [ ] A column at round index `i` shows `roundPoints[i].points`, or 0 when missing. The title-matching helper is deleted.
- [ ] `/control` page test (mocked `useAdminGame` with a `roomView` admin view, mocked quiz list):
  - the round columns render from the view while the quiz list is still empty
  - when the quiz list has a different number of rounds than the view, the table follows the view
- [ ] Teams table component tests:
  - two rounds with the same title each show their own points
  - a round with no `roundPoints` entry shows 0 for every team
  - sorting by a round column orders teams by that round's points
  - the existing cases pass
- [ ] `pnpm typecheck` and the frontend tests pass.
