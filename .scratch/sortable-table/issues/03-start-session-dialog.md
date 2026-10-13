# 03: Start session dialog leaves the session picker

**What to build:** Extract the "Start a new session" confirmation dialog from the session picker panel into its own component (see [spec](../spec.md)). It takes the quiz to start (or none, which closes it) and callbacks for close and for a created session. It owns the name, settings and tab form state (resetting when a different quiz is picked), the kahoot timer prefill (30 for a quiz with a kahoot round, empty otherwise), the create mutation with its error and invalidation, and the Overview and Settings tabs. The panel keeps which quiz is pending and the quiz list.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Behaviour, wording, accessible names and roles are unchanged; the quiz actions menu and delete flow are untouched.
- [ ] No standalone test for the component; the existing session picker tests (start dialog tabs, name, kahoot prefill, create, cancel, errors) pass unchanged.
- [ ] `pnpm --filter frontend test`, `pnpm typecheck` and `pnpm lint` pass.
