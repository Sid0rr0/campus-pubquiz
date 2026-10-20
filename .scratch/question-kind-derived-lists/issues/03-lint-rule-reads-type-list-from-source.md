# 03: The lint rule reads the type list from source

**What to build:** Adding a question type no longer means editing the lint config. The rule that bans comparing a question's type against a literal holds a hand copy of the type list today, because the lint config can't import TypeScript. A test keeps the copy equal to the shared type list. After this ticket, when the lint config loads, the rule parses the shared type list module with the TypeScript ESLint parser the repo already has and reads the elements of its array literal. The hand copy is deleted, and the rule's selectors and message are unchanged.

If the module can't be read, the list isn't found, or an element isn't a plain string, loading the config throws with a message naming the module. The rule never runs with an empty list, so a moved or reshaped type list can't turn it off silently.

See the spec's "Lists derived from the registry → The lint rule's type list".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The lint rule gets its type list by parsing the shared type list module when the config loads. The hand copy is gone.
- [ ] Loading throws with a message naming the module when the list can't be read or isn't a list of plain strings.
- [ ] The lint rule test checks that the parsed list equals the shared type list, replacing the check against the copy, and that loading against a module with no type list throws.
- [ ] `pnpm lint` still flags a type-literal comparison in backend and frontend source and still exempts test files.
- [ ] CODING_STANDARDS.md: the question type registry rule notes that the lint rule reads the type list from source, so adding a type needs no lint change.
- [ ] `pnpm typecheck`, `pnpm lint` and the shared types tests pass.
