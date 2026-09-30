# 05: Control panel context replaces the 34-field sidebar props

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** Adding an admin control to the quiz master's sidebars becomes one small change: add it to the Control panel context and render it in both sidebars. Today it needs a new field in a shared props interface plus two prop lists in /control.

/control provides one context value. It holds the sidebar-facing state:

- status, round and question indices, join code and quiz;
- connection error;
- the can-do flags;
- leaderboard and media state;
- teams, answered teams, break end time, text scale and showdown.

It also holds the sidebar-facing admin actions from the admin game hook.

The desktop sidebar and mobile admin bar read the context, and the mobile bar keeps only its own layout props. The leaf panels (navigation buttons, admin actions, teams panel, showdown panel and so on) stay prop-driven, so /remote keeps reusing them without the context. The quiz master sees no visual or behavioural change.

**Blocked by:** 02

**Status:** wontfix

- [ ] The shared 34-field sidebar props interface is deleted
- [ ] The desktop sidebar and mobile admin bar render from the Control panel context, and /control passes them no shared props
- [ ] The leaf panels keep their prop interfaces, and /remote still renders them without the context
- [ ] The existing /control page tests (advance controls, keyboard shortcuts, status and teams, showdown, leaderboard, end quiz and close session) pass unchanged in behaviour
- [ ] Using a sidebar outside the provider fails with a clear developer error rather than rendering empty

## Comments

**2026-10-01:** Superseded by `.scratch/props-refactor/spec.md`, ticket `.scratch/props-refactor/issues/03-control-panel-prop.md`. The goals stay the same: the shared sidebar props interface is deleted, and adding a control stops needing two prop lists in /control. The delivery changes from a context to one grouped Control panel prop. The only readers are the two sidebars one level below /control, which react.dev's "Before you use context" says to handle with props. A context would also give no re-render benefit here. Rationale: `.scratch/props-refactor/research.md`, "Where this differs from ticket 05".
