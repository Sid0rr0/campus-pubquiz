# Spec: One sortable table module across five panels, and a smaller session picker

Status: ready-for-agent

## Problem Statement

Five admin panels render a TanStack table with the same hand-written markup:

- the session picker's quiz list
- the teams directory
- the played sessions list on the stats page
- the questions table on a session's stats detail
- the control panel's teams table

Each one writes out the same wrapper, header row, sort button with up and down chevrons, body rows, and "nothing here yet" row. The copies have already drifted:

- The stats questions table hardcodes its empty row to span six columns instead of the column count.
- The control teams table uses a dark-blue tone and no sort buttons.
- The session picker shows its empty message outside the table instead of as an empty row.

A fix to how sorting is shown, for example adding an accessible sort state, has to be made five times and can miss one.

The session picker is also the longest of these panels (517 lines). Next to the quiz table it holds the running sessions list, with its close, remote and control actions, and the whole "Start a new session" confirmation dialog, with its name, overview and settings tabs and the create mutation. A developer changing the start dialog has to read past the running sessions list and the quiz table to find it.

## Solution

- **One sortable table component** renders any TanStack table: the wrapper, a header row where a sortable column's header is a button showing an up or down chevron for its sort direction, the body rows, and an optional empty-row message spanning every column. It has two tones: the default muted tone used by the admin pages, and the dark-blue tone of the control panel. All five panels use it and keep their own columns, data, sorting state and pagination.
- **The session picker gives up two pieces:**
  - The **running sessions list** renders the running sessions with close, remote and control.
  - The **start session dialog** owns the confirmation dialog, its form state and the create mutation.

  The panel keeps the page layout, the queries and the quiz table.

Nothing changes for the quiz master or admin: every table looks, sorts and reads the same, and the session picker behaves exactly as before.

## User Stories

1. As an admin, I want every table to look and sort exactly as before, so that this refactor changes nothing I use.
2. As an admin, I want to click a sortable column's header to toggle its sort, so that I can order the list.
3. As an admin, I want an up or down chevron on the column a table is sorted by, so that I can see the current order.
4. As an admin, I want columns that can't be sorted to show a plain header, so that I don't click something that does nothing.
5. As an admin, I want an empty table to show its "nothing here yet" message across the full table width, so that the message reads cleanly.
6. As an admin, I want the stats questions table's empty row to span however many columns it has, so that adding a column never breaks its layout.
7. As an admin, I want the teams directory and played sessions to keep their server-side sorting and paging, so that large lists stay fast.
8. As a quiz master, I want the control panel's teams table to keep its dark-blue look, so that it matches the rest of the control panel.
9. As a quiz master, I want the session picker's quiz list to keep its default order (most recently edited first) and its name and edited-date sorting, so that I find my quiz the same way.
10. As a quiz master, I want the session picker to keep showing "No quizzes yet." when there are none, so that an empty account is explained.
11. As a quiz master, I want the running sessions list to show each session's name, status, team count, join code (with copy) and start time, so that I can pick the right one.
12. As a quiz master, I want Close only on ended sessions, and Remote and Control on every session, so that I can't close a running game by accident.
13. As a quiz master, I want "No sessions running yet." when nothing is running, so that I know there's nothing to rejoin.
14. As a quiz master, I want the start session dialog to show the quiz's rounds and questions in an Overview tab and the session settings in a Settings tab, so that I can check before starting.
15. As a quiz master, I want the session name to default to the quiz title and be editable, so that I can tell sessions apart.
16. As a quiz master, I want the kahoot question timer prefilled to 30 seconds for a quiz with a kahoot round and empty otherwise, so that kahoot rounds work by default.
17. As a quiz master, I want confirming the dialog to create the session and open it, and cancelling to create nothing, so that starting is deliberate.
18. As a quiz master, I want a failed create to show an error, so that I know to try again.
19. As an admin, I want quiz delete (admins only) and the quiz actions menu to work as before, so that quiz management doesn't change.
20. As a developer, I want the table markup in one component, so that a change to how sorting is shown is made once.
21. As a developer, I want each panel to contain only its columns, data, sorting and paging, so that a panel reads as what it lists.
22. As a developer, I want the start session dialog in its own component, so that I can change starting a session without reading the session picker.
23. As a developer, I want the running sessions list in its own component, so that its actions are found by name.
24. As a developer, I want every existing panel test to pass unchanged, so that they prove nothing changed.

## Implementation Decisions

- **New sortable table component (frontend, shared components).** Its props:
  - a TanStack table instance (generic over the row type)
  - an optional empty message
  - an optional tone: `muted`, the default (the admin pages' foreground tones), or `dark-blue` (the control panel's)

  It renders:
  - the scroll wrapper with a rounded border
  - one header row per header group, where a placeholder header renders nothing, a sortable column renders a button with the header and the chevron for its sort direction, and any other column renders its header
  - the body rows
  - when there are no rows and an empty message is given, one row spanning every column with the message

  Class names per tone match what the panels use today, so the pages look identical.
- **Each panel keeps its own table state.** Columns, data, sorting state, manual sorting or pagination, row ids and the Prev/Next pagination controls stay in the panels. The component renders only. Pagination is not shared, because only two panels page and their controls differ in wording.
- **Panel adoption:**
  - The **teams directory** and **played sessions** use the default tone with their existing empty messages.
  - The **stats questions table** uses the default tone with "No questions in this quiz.". Its empty row now spans the real column count instead of a hardcoded six, which renders the same for today's six columns.
  - The **control teams table** uses the dark-blue tone with "No teams have joined yet." Its columns aren't sortable, so its headers render plain as today.
  - The **session picker's quiz table** uses the default tone with no empty message, because the panel keeps showing "No quizzes yet." instead of an empty table.
- **Running sessions list component.** It takes the running sessions, a close handler and an open-session handler, and renders the empty message and one row per session with copy, close (ended sessions only), remote and control. The panel keeps the sessions query and the close mutation.
- **Start session dialog component.** It takes the quiz to start (or none, which closes it) and callbacks for close and for a created session. It owns:
  - the name, settings and tab form state, including resetting when a different quiz is picked
  - the kahoot timer prefill
  - the create mutation and its error and invalidation
  - the overview and settings tabs

  The panel keeps which quiz is pending and the quiz list.
- **Unchanged:** wording, accessible names, roles and the other quiz-actions menu and delete flow. No backend or shared-types changes.

## Testing Decisions

- **A good test interacts with a panel the way an admin does and asserts what they see:** headers, sort chevrons and order after clicking, empty messages, rows, dialog contents, and what was sent to the API. It never imports the sortable table, the running sessions list or the start session dialog directly.
- **No new seams.** These existing panel tests stay unchanged and must pass at every step:
  - the session picker tests: running sessions, quiz table sorting, the start dialog with its tabs, name, kahoot prefill, create, cancel and errors, and quiz delete
  - the sessions page tests
  - the teams directory tests: plain headers without a sort toggle, toggling the Joined sort
  - the played sessions tests: toggling the Date sort
  - the stats detail tests
  - the control teams table tests
- **No standalone table component test.** Every case it covers is visible through the panels.
- **Prior art:** the panel tests above, which already query headers, sort buttons and empty rows by role and text.

## Out of Scope

- Any visible change to tables, including adding `aria-sort` or other new sort affordances. Worth a follow-up, made once in the shared component.
- Sharing pagination controls, or moving sorting or paging state into the shared component.
- The stats detail's rounds and standings tables, which are plain tables rather than TanStack tables.
- Changing the quiz actions menu or the quiz delete flow.
- The other candidates in the 2026-10-08 architecture review.

## Further Notes

- Source: candidate 7 of the 2026-10-08 architecture review ("Splitting the long files"), rated "Speculative": one interface, five callers, but the payoff is mostly cosmetic and the area has low bug density. The concrete wins are the questions table's hardcoded column span and having one place to add accessible sort state later.
- No glossary, documentation or `/guide` change is expected, since behaviour is unchanged.
