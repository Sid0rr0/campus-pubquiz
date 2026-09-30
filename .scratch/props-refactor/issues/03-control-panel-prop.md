# 03: The Control panel prop replaces the 32-field sidebar interface

Parent spec: `.scratch/props-refactor/spec.md`

Replaces: `.scratch/role-socket-hooks/issues/05-control-panel-context.md`. Same goals, but a single prop instead of a React context.

**What to build:** Adding a control to the quiz master's sidebars stops needing a new interface field plus two prop lists in /control. /control builds one Control panel object and passes it to the desktop sidebar and the mobile admin bar as a single prop. The shared 32-field sidebar props interface is deleted.

The Control panel groups:

- the slice of the admin view the sidebars show, passed through unchanged and typed by picking from the admin view type, with `progress` as one object and the two server-decided flags from ticket 01;
- the active quiz's id and title (REST, not socket);
- the connection error;
- the controls from ticket 02;
- the actions: the admin game hook's actions with their own acknowledgement-returning signatures, plus closing the session.

Shape from the spec (member names may be adjusted):

```ts
interface ControlPanel {
  view: ControlPanelView;          // Pick<AdminStatePayload, 'progress' | 'joinCode' | 'teams' | …>
  quiz: { id: number | null; title: string | null };
  connectionError: string | null;
  controls: ControlPanelControls;  // from ticket 02's function
  actions: ControlPanelActions;    // Pick<UseAdminGameResult, 'sendAction' | 'kickTeam' | …> & { closeSession }
}
```

Inside each sidebar, the leaf panels still get their own props, read from the Control panel. The mobile admin bar keeps only its own layout props (signed-in user, logout) beyond the Control panel, and keeps closing its drawer after an action or closing the session. The quiz master sees no visual or behavioural change.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] The shared 32-field sidebar props interface is deleted
- [ ] Both sidebars take one Control panel prop; /control no longer writes out two prop lists
- [ ] The Control panel's actions keep the admin game hook's acknowledgement-returning signatures
- [ ] The mobile drawer still closes after an action or closing the session
- [ ] The leaf panels keep their own prop interfaces, and /remote still renders them without the Control panel
- [ ] Existing /control page tests (advance controls, previous button, keyboard shortcuts, status and teams, teams table, leaderboard, showdown, end quiz and close session, rejected actions, connection) pass unchanged in behaviour
