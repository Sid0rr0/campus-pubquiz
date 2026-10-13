# 01: One sortable table component renders the five panels' tables

**What to build:** Add a sortable table component to the frontend shared components and move all five TanStack table panels onto it (see [spec](../spec.md)). Nothing changes for the admin or quiz master.

The component takes a TanStack table instance, an optional empty message and an optional tone (`muted` default, or `dark-blue`). It renders the scroll wrapper with a rounded border, one header row per header group (a placeholder header renders nothing, a sortable column renders a button with the header and an up or down chevron, any other column renders its header), the body rows, and, with no rows and a message, one row spanning every column. Class names per tone match what the panels use today.

Panels adopt it and keep their own columns, data, sorting, paging and Prev/Next controls:

- teams directory and played sessions: default tone, existing empty messages
- stats questions table: default tone, "No questions in this quiz."; the empty row spans the real column count
- control teams table: dark-blue tone, "No teams have joined yet."
- session picker's quiz table: default tone, no empty message (the panel keeps showing "No quizzes yet.")

**Blocked by:** None (can start immediately)

**Status:** done

- [x] No panel hand-writes table, header, sort-button or empty-row markup any more.
- [x] No standalone test for the component; the existing panel tests (session picker, sessions page, teams directory, played sessions, stats detail, control teams table) pass unchanged.
- [x] No backend or shared-types changes; no wording, accessible name or role changes.
- [x] `pnpm --filter frontend test`, `pnpm typecheck` and `pnpm lint` pass.
