# 02: Kahoot hint and backend refusal name the same types

**What to build:** When a kahoot round holds a question type kahoot doesn't accept, the round editor's hint and the error a save returns name the accepted types with the same words, read from the registry. Today the editor's hint is hand-written ("Kahoot rounds only hold multiple choice, sort, match and number"), while the backend builds its refusal from the registry labels with different wording. A change to which types kahoot accepts would update one and leave the other wrong.

One shared function returns the types a kahoot round accepts as a readable list: each type's label lowercased, comma-separated with "and" before the last, in the type picker's order (for example "multiple choice, sort / order, match pairs and number"). The editor hint ("Kahoot rounds only hold … questions") and the backend refusal both use it. The hint still names the positions of the questions blocking kahoot mode. The kahoot rule itself stays its own registry field, per ADR 0001.

See the spec's "Lists derived from the registry → Kahoot type names".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One shared function produces the kahoot type names list from the registry.
- [ ] The round editor's kahoot hint uses it and has no hand-typed type names, and still names the blocking positions.
- [ ] The backend's kahoot refusal message uses it.
- [ ] Registry parity test case: the list names exactly the kahoot-accepted types, by lowercased label, in the type picker's order, with "and" before the last. The existing ADR 0001 case stays.
- [ ] The quiz editor panel spec checks that the kahoot hint names the types from the shared list.
- [ ] The backend quiz draft schema cases for a refused kahoot round are updated to the new wording.
- [ ] `pnpm typecheck`, `pnpm lint` and the shared types, frontend and backend tests pass.
