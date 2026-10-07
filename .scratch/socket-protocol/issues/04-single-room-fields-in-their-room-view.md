# 04: Fields only one room reads move into that room's view

**What to build:** Each room's state view carries only the fields some page in that room reads. Phones, the big screen and `/control` stop receiving fields they never render, and a developer adding a field that only one room reads adds it to that room's view alone. Nothing changes on screen.

The fields leave the shared `StateSnapshotPayload` and move as follows (the compiler is the final word: if removing a field from the base breaks a second room's page, that field stays in the base):

- display view only: `roundCategory`, `roundAuthor`, `roundCategories`, `roundAuthors`, `leaderboardRevealCount`, `kahootQuestionEndsAt`;
- admin view only: `ungradedQuestionIds`, `phaseStartedAt`, `phaseElapsedMs`;
- players view only: `upcomingQuestions`, `pastRevealedQuestions`.

The Screen projection adds each moved field in its own room's view, and the core snapshot stops building it for the others. Fields read by `/display` and `/control` but not `/play` (`answeredTeamIds`, `questionLockAt`, `breakEndsAt`, `displayTextScale`) stay in the base; narrowing those is out of scope.

`DOCUMENTATION.md`'s snapshot table, in the same change, says which fields are the shared base and which belong to one room's view.

This needs ticket 02 first: the phone's game hook reads `pastRevealedQuestions` through its state listeners, which only see the players view once they're typed by the protocol.

Parent spec: `.scratch/socket-protocol/spec.md`

**Blocked by:** 01 (Split the socket-events file by concept), 02 (The protocol map, and the frontend typed against it)

**Status:** done

- [x] Written first: Screen projection and core snapshot specs assert that each moved field appears in its own room's view and is absent from the other two rooms' views.
- [x] `StateSnapshotPayload` no longer declares the moved fields; each is declared on its room's view type.
- [x] A reconnecting client's `STATE_SYNC` carries the same moved fields as a live `STATE_UPDATED` for its room (the resync path is covered alongside the live path).
- [x] Backend specs and frontend page fixtures that put a moved field on the wrong room's view are updated; no page gains a defensive default to paper over a missing field.
- [x] `/display`, `/control`, `/remote` and `/play` page tests pass.
- [x] `DOCUMENTATION.md`'s snapshot table is updated.
- [x] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass across all workspaces.
