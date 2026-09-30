# Spec: Grouped Control panel props, and passing whole objects

Status: ready-for-agent

Research: `.scratch/props-refactor/research.md` (primary-source review of the options, with file:line references).

Supersedes: `.scratch/role-socket-hooks/issues/05-control-panel-context.md`. That ticket's goals (the shared 34-field sidebar props interface is deleted, and adding a control stops needing edits in four places) are kept. Its delivery mechanism, a React context, is replaced by one grouped prop (see Implementation Decisions).

## Problem Statement

A developer adding or changing a control in the quiz master's sidebars has to touch far more code than the change deserves, and the extra code is where bugs creep in.

- **The sidebars take 32 loose props that they never use themselves.** The desktop sidebar takes 32 props and the mobile admin bar takes 34. Both are layout shells: they only hand the values on to eight smaller panels. /control writes the same 32-prop list out twice, once per sidebar. Adding one control means a new field in the shared interface, a line in each of the two prop lists in /control, and a line in each sidebar.
- **One server object gets split into five props.** The admin view's `progress` (status, round index, question index, leaderboard visible, media fullscreen) is split into five separate props, and the panels take them back again one by one.
- **The same "can I / should I show" rules are written twice.** Whether media can be replayed, whether per-team answer status is shown, and how many leaderboard reveal steps there are, are computed in /control and again, word for word, in /remote. /remote's own comment points back at /control's copy.
- **Two server rules are re-implemented in the browser.** Whether the showdown tiebreaker can be set up yet, and whether the current question is the last one before a break, are both worked out on the client from a separately fetched quiz list. The showdown check hand-copies the backend's list of graded statuses. The admin view exists precisely so the server decides this kind of thing, as it already does for Advance and Previous availability.
- **The sidebar's callback types throw away the server's acknowledgement.** The admin game hook's actions return the server's typed acknowledgement, but the sidebar interface types them as returning nothing. A panel that wants to react to a rejection has to widen the type again, as the showdown panel already had to.
- **Other components get objects taken apart at every call site.** The question display receives up to nine fields of one question, spread apart at four call sites. The rules content receives four session settings fields, spread identically at three call sites. The /control question browser receives the admin view's on-air indicators under three renamed props.

## Solution

The quiz master sees no change. For a developer:

- /control builds one **Control panel** object and passes it to both sidebars as a single prop. The object has five groups:
  - the slice of the admin view the sidebars show, passed through unchanged, with `progress` as one object;
  - the active quiz's id and title, which come from the REST quiz list, not the socket;
  - the connection error;
  - the **controls**: every "can I / should I show" flag, derived once;
  - the **actions**: the admin game hook's actions with their own signatures (acknowledgements included), plus closing the session.
- The presentational controls are computed by one pure function that /control and /remote both call, so the duplicated derivations exist once.
- The admin view gains two server-decided flags, "showdown eligible" and "last question before break", computed in the Screen projection next to Advance/Previous availability. The browser's hand-copied graded-status list is deleted.
- The sidebars keep rendering the same eight leaf panels. The leaf panels keep their own prop interfaces, so /remote keeps reusing them unchanged.
- Three smaller components take the object their caller already has, instead of its fields spread apart: the question display takes a question, the rules content (and the phone's game status screens) take the session settings, and the /control question browser takes the admin indicators.

## User Stories

1. As a quiz master, I want every sidebar control on /control to look and behave exactly as it does today, so that the refactor is invisible during a live quiz.
2. As a quiz master on a phone-width screen, I want the mobile admin bar's drawer to still close itself after I trigger an action or close the session, so that the drawer doesn't cover the screen.
3. As a quiz master, I want Start, Advance, Previous, End quiz and Close session to stay enabled and disabled exactly as they are today, so that I can trust the buttons.
4. As a quiz master, I want the Show Next Team / Hide Leaderboard control to step through the same reveal steps as today, so that leaderboard reveals don't change.
5. As a quiz master, I want the replay-media button to appear exactly when a YouTube question is open, as today, so that I can restart a clip.
6. As a quiz master, I want per-team answered ticks shown only while a question is open or locking, as today, so that the teams panel stays readable in other phases.
7. As a quiz master, I want to be able to pre-set the break end time while still on the block's last question, as today, so that it's ready when the break screen appears.
8. As a quiz master, I want the showdown panel to offer the tiebreaker as soon as the final block is graded and teams are tied for first, as today, so that I don't have to wait for the reveal walk to finish.
9. As a quiz master, I want the showdown panel never to offer the tiebreaker during a mid-quiz tie, as today, so that it can't be started early by mistake.
10. As a quiz master whose laptop reconnects mid-quiz, I want "showdown eligible" and "last question before break" restored from the server's resync, so that the controls are correct straight away without waiting for the quiz list to reload.
11. As a quiz master whose quiz list request is slow or fails, I want the showdown and break-end-time controls to still be correct, so that they don't depend on a second request succeeding.
12. As a quiz master using /remote, I want the replay-media button, the answered ticks and the leaderboard reveal steps to behave exactly like /control's, so that presenting from my phone matches the laptop.
13. As a quiz master, I want kicking a team, setting the break end time, changing the display text scale and composing a showdown round to keep working from both sidebars, so that nothing is lost in the regrouping.
14. As a quiz master, I want a rejected sidebar action to keep showing the same error feedback as today, so that I know when the server refused.
15. As a quiz master, I want the grading panel's question browser to keep marking the question on display, and the round title and break indicators, as it does today, so that it mirrors the big screen.
16. As an audience member watching the big screen, I want questions, options, media and revealed answers to render exactly as today, so that the question display change is invisible.
17. As a team, I want the question browser on my phone to keep showing questions without media, as today, so that my phone doesn't play the big screen's audio or video.
18. As a team, I want the rules screen on my phone, on the big screen and on the standalone rules page to show the same house rules, bonus categories and player limits as today, so that the settings change is invisible.
19. As a developer, I want the shared 32-field sidebar props interface deleted, so that there is no flat list of loose fields to keep in sync.
20. As a developer, I want to pass both sidebars one Control panel prop, so that /control no longer writes out two identical 32-prop lists.
21. As a developer adding a sidebar control whose data already exists in the admin view, I want to add it in the Control panel builder and render it in the sidebars, so that I don't also edit an interface and two prop lists.
22. As a developer, I want the admin view's `progress` passed as one object, so that the sidebars speak the projection's vocabulary instead of five renamed copies.
23. As a developer, I want the sidebar-facing view slice typed by picking fields from the admin view type, so that a projection change flows through without re-declaring fields.
24. As a developer, I want the replay-media, answer-status, leaderboard-step and start/end/close rules computed by one pure function, so that /control and /remote can't drift apart.
25. As a developer, I want "showdown eligible" decided by the server from the session's own rounds and grading state, so that the browser no longer hand-copies the backend's graded-status list.
26. As a developer, I want "last question before break" decided by the server, so that /control no longer rebuilds block boundaries from a separately fetched quiz list.
27. As a developer, I want the sidebar actions to keep the admin game hook's acknowledgement-returning signatures, so that a panel can await the server's answer without widening a type.
28. As a developer, I want the leaf panels (navigation buttons, admin actions, teams panel, showdown panel and the rest) to keep their own prop interfaces, so that /remote renders them without knowing about the Control panel.
29. As a developer, I want the sidebars to receive their data through a plain prop rather than a context, so that it is obvious which components use which data and a sidebar can't be rendered outside a missing provider.
30. As a developer, I want the question display to take one question object, so that its four call sites stop spreading the same nine fields.
31. As a developer, I want the rules content and the phone's game status screens to take the session settings as one object, so that three call sites stop spreading the same four fields.
32. As a developer, I want the /control question browser to take the admin indicators object, so that it stops renaming three fields on the way in.
33. As a developer, I want the existing /control, /remote, /display and /play page tests to pass without behavioural changes, so that I can trust the refactor preserved behaviour.

## Implementation Decisions

### Delivery: one grouped prop, not a context

- Both sidebars take a single Control panel prop. The mobile admin bar keeps only its own layout props beyond that (the signed-in user and logout), and keeps wrapping the close-session and action callbacks so its drawer closes.
- A context is not used. React's guidance ("Before you use context") is to start with props when the readers are one level down, and here the only readers are the two sidebars directly under /control. A context would give no re-render benefit either: /control re-renders on every state broadcast, and the project uses neither `memo` nor the React Compiler.
- Having the sidebars call the admin game hook themselves is ruled out. Each call opens its own admin socket with its own snapshot, and hooks share logic, not state.
- Passing panels in as children or slots is not used, because the mobile drawer's close-on-action wrapping and the two layouts' different panel order make that API clumsier than one grouped prop.

### The Control panel shape

The shape below, from the research note, encodes the decision; member names may be adjusted during implementation:

```ts
type ControlPanelView = Pick<
  AdminStatePayload,
  | 'progress'
  | 'joinCode' | 'teams' | 'answeredTeamIds'
  | 'breakEndsAt' | 'displayTextScale' | 'activeShowdown'
  | 'leaderboardRevealCount'
  | 'canAdvance' | 'canGoToPreviousQuestion'
  | 'isShowdownEligible' | 'isLastQuestionBeforeBreak' // new, server-decided
>;

interface ControlPanelControls {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  canReplayMedia: boolean;
  showAnswerStatus: boolean;
  leaderboardStepCount: number;
  tiedTeamNames: string[];
}

type ControlPanelActions = Pick<
  UseAdminGameResult,
  'sendAction' | 'kickTeam' | 'setBreakEndTime' | 'setDisplayTextScale' | 'createShowdownRound'
> & { closeSession: () => void };

interface ControlPanel {
  view: ControlPanelView;
  quiz: { id: number | null; title: string | null }; // REST, not socket
  connectionError: string | null;
  controls: ControlPanelControls;
  actions: ControlPanelActions;
}
```

- Inside each sidebar, the leaf panels are still given their own props, read from the Control panel (for example, the navigation buttons' status comes from the view's progress).
- The Control panel's view is the admin view passed through. The fallback defaults /control applies today while destructuring (empty team list, default text scale and so on) are dropped for the fields the admin view types as always present.

### Controls derived once, shared with /remote

- One pure function in the frontend takes the admin view and returns the presentational controls: can start, can end, can close the session, can replay media, show answer status, leaderboard reveal step count, and the names of the teams tied for first.
- /control uses it to build the Control panel. /remote calls the same function for the flags it shows (replay media, answer status, leaderboard steps) in place of its own copies.
- The function reads only the admin view, never the REST quiz list, so /remote (which doesn't fetch the quiz list) can use it without special cases.

### Two flags move into the admin view

- The admin view (shared types) gains `isShowdownEligible` and `isLastQuestionBeforeBreak`, both booleans, both admin-only.
- The Screen projection's admin branch computes them from the live session, next to the existing Advance/Previous availability:
  - **Showdown eligible:** the session is on its final round, no questions are left ungraded, and the status is one of the graded statuses the block-grading service already owns (break intro, break, break round intro, reveal intro, reveal, ended). The backend's own graded-status list is the single definition; the browser's copy is deleted.
  - **Last question before break:** a question is open or locking, and the current question is a break point in the session's own round structure (the shared block-position helper already answers this).
- Both reach /control on every admin broadcast and on reconnect, like any other admin view field. /control stops deriving them from the REST quiz list.

### Smaller components take whole objects

- **Question display:** takes one question prop, typed by picking the fields it renders from the shared question view type, with the reveal-only fields (answer, answer media) optional. Its presentation props (test-id prefix, autoplay, prompt class, fullscreen, media replay token, the team's own answer) stay separate. The call sites pass the question they already hold. The phone's question browser, which deliberately shows no media, says so explicitly (either a flag or a question object without media) rather than relying on leaving fields out. The current rename of the answer to "correct answer" is dropped in favour of the shared type's name.
- **Rules content, and the phone's game status screens:** take the session settings as one object, typed by picking the four fields they use (house rules, enabled bonus categories, max players per team, extra player penalty points) from the shared session settings type. The display, /play and the standalone rules page pass the settings object they already have.
- **/control question browser:** takes the admin indicators object from the admin view instead of three renamed props.

### Unchanged

- The leaf panels' prop interfaces, including those shared with /remote.
- The admin game hook's API.
- The quiz editors, the join form and the phone's question browser, whose props are genuinely separate inputs.

## Testing Decisions

- **A good test here checks what the quiz master, the audience or a team sees and can do**: which buttons are enabled, what renders, which socket action goes out. It never checks how a sidebar receives its data, whether a Control panel object exists, or what a pure helper returns in isolation. The refactor is behaviour-preserving, so the existing behavioural tests are the main safety net, and they should pass with only fixture changes.
- **Seam 1: the page-level frontend tests (Vitest).** These render the whole page with the admin game hook mocked and an admin view fixture, and they are the main seam:
  - /control: advance controls, previous button, keyboard shortcuts, status and teams, teams table, leaderboard, showdown panel, end quiz and close session, rejected actions, grading question browsing, connection;
  - /remote: the remote page tests;
  - /display and /play tests, for the question display, rules content and game status screens changes.

  The shared controls function is covered through these pages, not with unit tests of its own. The admin view fixture builder in the /control test utilities must fill in the two new admin view fields (default false). Tests that exercise the showdown panel's eligibility and break-end-time pre-setting set those fields on the fixture directly, as they already do for Advance/Previous availability. They no longer rely on the mocked quiz list for them.
- **Seam 2: the backend Screen projection specs (Jest).** The two new flags get specs where the admin branch is already tested. Prior art: the action availability spec and the Screen projection spec in the backend game tests. Cases to cover:
  - showdown eligible across the graded statuses, when not on the final round, and while questions remain ungraded;
  - last question before break at a block's last question versus a mid-block question, in each of question open, locking and a non-question status.
- No new test seam is introduced.
- Prior art for fixtures: the /control test utilities' admin view builder and its default action availability show how to add server-decided fields to fixtures.

## Out of Scope

- A Control panel context. Ticket 05's context is superseded by the single prop; see Delivery.
- Changing the leaf panels' prop interfaces, for example having the navigation buttons or break end time control take `progress` directly. That's a possible follow-up once the sidebars pass `progress`.
- Folding the admin game hook's separate actions into one dispatch-style command union.
- Swapping the teams table's round titles from the REST quiz list to the snapshot's round titles. The research flags this as possibly redundant, but the two sources must first be checked for equivalence.
- Refactoring the quiz editors, the join form or the phone's question browser props.
- Having the mobile admin bar read the signed-in user from the auth context instead of props.
- Any visual or behavioural change for quiz masters, teams or the audience.

## Further Notes

- Suggested order, each step shippable on its own:
  1. Move the two flags into the admin view (shared types, backend projection and its specs, frontend fixture default); /control reads them from the view.
  2. Build the shared controls function and the Control panel, pass it to both sidebars, and delete the 32-field interface; /remote switches to the shared function.
  3. The three smaller "pass the whole object" changes: rules content/settings, the admin indicators, and the question display, in increasing order of size.
- Ticket 05 in `.scratch/role-socket-hooks/issues/` should be marked superseded by this spec (Status: `wontfix`, with a comment pointing here) when this spec is broken into tickets.
- Adding the two admin view fields adds new fields to the admin broadcast payload. The display and players views must not gain them.
