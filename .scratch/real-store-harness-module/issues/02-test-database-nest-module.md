# 02: A test database Nest module over the worker's ORM

**What to build:** A spec can compile a Nest module whose repositories read and write the worker's test database, and closing that module leaves the worker's database connection open for the next spec file. This is the database half of building the real-store harness from the Game module (ticket 03), proven on its own first.

- **A test-only global Nest module**, built from the worker's ORM (the one the test database module already hands each spec). It provides:
  - the ORM;
  - its entity manager;
  - a repository for every entity the database module registers in the app.

  Injection works the same as in the app: providers that ask for an entity's repository get one. Repositories resolve from the global entity manager, so request-context handlers fork their own entity manager per call, as in the app.

- **Closing a module compiled with it never closes the worker's ORM.** `@mikro-orm/nestjs` closes the ORM it registered when its module shuts down, so this module must not register the worker's ORM in a way that gets closed. That might mean not going through the library's own root module at all, or making sure its shutdown hook can't reach the shared ORM. The symptom to rule out: the next spec file on the same worker failing to connect.
- It doesn't change how specs get the database today. `useTestDatabase`, its truncation between tests, and the answer-service and showdown-service harnesses stay as they are.

Parent spec: `.scratch/real-store-harness-module/spec.md`

**Blocked by:** None (can start immediately). It can run in parallel with 01.

**Status:** ready-for-agent

- [ ] A spec compiles a small module over the test database module, with a provider that injects one entity repository. That provider writes a row and reads it back through the worker's database.
- [ ] The same spec closes that module, then uses the worker's ORM directly (for example, a query in the next test), and it is still connected.
- [ ] Rows written through the module are emptied between tests, like any other row.
- [ ] The existing test database specs (including the isolation pair) pass unchanged.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
