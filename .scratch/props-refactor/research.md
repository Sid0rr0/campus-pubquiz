# Research: reducing wide props interfaces in apps/frontend

Status: research only (no code changed). Written 2026-10-01 against `008f866` (admin game hook landed).

Question: "There are components with many props (like `AdminSidebarProps`). Can they be reduced or refactored?"

Related decision already on file: `.scratch/role-socket-hooks/issues/05-control-panel-context.md` ("Control panel context replaces the 34-field sidebar props"), from the spec at `.scratch/role-socket-hooks/spec.md:17,32,126`. This note checks that decision against the primary sources and the current code. Where the note disagrees with it, the disagreement is called out explicitly (see "Where this differs from ticket 05").

---

## TL;DR

- `AdminSidebarProps` has **32 fields** (`apps/frontend/app/control/admin-sidebar-props.ts:10-48`). `MobileAdminBarProps` extends it with 2 more, for **34** (`mobile-admin-bar.tsx:19-22`). That 34 is the "34-field" figure in the spec. Both sidebars are **pure pass-through layout shells**. They use none of the 32 values themselves, except that the mobile bar wraps two callbacks to close its drawer (`mobile-admin-bar.tsx:63-71`). /control spells the same 32 props out twice (`page.tsx:424-493`).
- Only **14 of the 32** are raw server-view fields, and 5 of those are the fields of one `progress` object spread apart. **9 are derived on the client**: 7 from the view alone, 2 also from the REST quiz list. Three of the derivations are copied verbatim in /remote. **6 are callbacks**, **2 come from the REST quiz list**, and **1 is the connection error**.
- The sidebars should **not** call `useAdminGame` themselves. Each call opens its own socket (`use-game-connection.ts:82`), and react.dev says hooks share logic, not state.
- Recommendation: **first group the data** (a `progress` object, one `controls` object built by a single pure function shared with /remote, one `actions` object), which brings 32 flat fields down to about 7 grouped members. **Then** deliver that one object to the two sidebars. A single prop is enough per react.dev's "start by passing props". Ticket 05's context is fine if the team wants /control to carry no prop lists, but it should carry the grouped shape, not the 32 flat fields.
- Other offenders are much smaller. The clear wins are "pass the object you already have": `settings` into `RulesContent`/`GameStatusScreens`, `AdminIndicators` into `QuestionBrowserPanel`, and the question into `QuestionDisplay`. The quiz editors and `JoinForm` are fine as they are.

---

## 1. Survey: the worst offenders

Fields are counted by hand from each interface (a regex count over-counts multi-line callback signatures). Only `*Props` interfaces under `apps/frontend/app` were counted, excluding `__tests__`.

| # | Interface | Fields | Defined at | Rendered by | Layers the data crosses | Nature |
|---|---|---|---|---|---|---|
| 1 | `MobileAdminBarProps` | 34 (32 inherited + `user`, `onLogout`) | `control/mobile-admin-bar.tsx:19-22` | `control/page.tsx:424-459` | page → bar → 7 leaf panels (2 layers) | Prop drilling through a layout shell |
| 2 | `AdminSidebarProps` (used by `DesktopSidebar`) | 32 | `control/admin-sidebar-props.ts:10-48` | `control/page.tsx:460-493` | page → sidebar → 7 leaf panels (2 layers) | Prop drilling through a layout shell |
| 3 | `QuestionDisplayProps` | 15 | `display/question-display.tsx:114-138` | 4 call sites (`display/page.tsx:347-360`, `display/question-open-screen.tsx:34-46`, `display/break-review-screen.tsx:21-31`, `play/question-browser.tsx:115-124`) | 1 | Up to 9 are one question object's fields spread apart at every call site |
| 4 | `GameStatusScreensProps` | 14 | `play/game-status-screens.tsx:11-31` | `play/page.tsx:393-408` | page → screens → `RulesContent` (2 layers for 4 of them) | 4 fields are `settings.*` spread apart and forwarded unchanged (`game-status-screens.tsx:81-87`) |
| 5 | `QuestionBrowserProps` (/play) | 14 | `play/question-browser.tsx:23-47` | `play/page.tsx:413-436` | 1 | Mostly distinct inputs. Already groups navigation into one object (`question-browser.tsx:16-21,46`) |
| 6 | `QuestionBrowserPanelProps` (/control) | 13 | `control/question-browser-panel.tsx:12-37` | `control/page.tsx:505-519` | page → panel → `AnswersPanel` (2 layers for 3 of them) | 3 are `AdminIndicators` renamed. 3 are only forwarded to `AnswersPanel` (`question-browser-panel.tsx:190-196`) |
| 7 | `QuizQuestionEditorProps` | 12 | `quizzes/[id]/quiz-question-editor.tsx:31-48` | `quiz-round-editor.tsx:258-274` | 1 (`isLive` crosses 2) | Distinct inputs plus 4 row callbacks |
| 8 | `QuizRoundEditorProps` | 11 | `quizzes/[id]/quiz-round-editor.tsx:28-43` | `quiz-editor-panel.tsx:561-575` | 1 | Distinct inputs plus 4 row callbacks |
| 9 | `JoinFormProps` | 10 | `components/join-form.tsx:8-21` | `play/page.tsx:173-184` (and the home page) | 1 | Three controlled value/onChange pairs |
| - | `NavigationButtonsProps`, `AdminActionsProps` | 9 each (incl. `className`/`children`) | `control/navigation-buttons.tsx:8-19`, `control/admin-actions.tsx:16-26` | both sidebars and /remote (`remote/page.tsx:271-285`) | leaf | Leaf panels shared with /remote. Distinct inputs |

Everything below 9 fields (`TeamsTableProps` 5, `ShowdownPanelProps` 5, `SessionStatusPanelProps` 6, etc.) is unremarkable.

### How the sidebar props travel

`useAdminGame` → `AdminPageContent` (derives values, `page.tsx:300-419`) → `MobileAdminBar` **and** `DesktopSidebar` (identical 32-prop lists, `page.tsx:424-493`) → `SessionStatusPanel`, `NavigationButtons`, `AdminActions`, `BreakEndTimeControl`, `DisplayTextScaleControl`, `EditQuizLink`, `ShowdownPanel`, `TeamsPanel` (`desktop-sidebar.tsx:49-101`, `mobile-admin-bar.tsx:109-163`).

The sidebar bodies only destructure the props and hand them on (`desktop-sidebar.tsx:12-45`, `mobile-admin-bar.tsx:25-60`). The one piece of behaviour of their own is the mobile drawer closing after an action (`mobile-admin-bar.tsx:63-71`). No test renders either sidebar directly. Every /control page test renders the whole page with `useAdminGame` mocked through `adminGameResult` (`control/__tests__/test-utils.tsx:134-159`). So how the sidebars receive their data is invisible to the tests.

---

## 2. What the 32 sidebar props are

| Kind | Props | Source (file:line) |
|---|---|---|
| **Server-projected view, raw** (14) | `progressStatus`, `roundIndex`, `questionIndex`, `isLeaderboardVisible`, `isMediaFullscreen` (**all 5 are `snapshot.progress.*`**, `GameProgress` at `shared/types/src/game-state-types.ts:56-69`); `joinCode`, `teams`, `answeredTeamIds`, `breakEndsAt`, `displayTextScale`, `activeShowdown`, `leaderboardRevealCount`; `canAdvance`, `canGoToPreviousQuestion` (admin-only projection fields, `socket-events.ts:339-345`) | `page.tsx:310,323-324,369-383,425-428,437,440` |
| **Derived on the client from the view alone** (7) | `canStartQuiz` (`page.tsx:322`), `canEndQuiz` (`:402`), `canCloseSession` (`:403`), `showAnswerStatus` (`:400-401`), `canReplayMedia` (`:406-408`), `leaderboardTeamCount` (`:306-309`), `tiedTeamNames` (`:384-386`) | pure functions of the admin view |
| **Derived from the view plus the REST quiz list** (2) | `isShowdownEligible` (`page.tsx:392-396`, which **mirrors the backend's `GRADED_STATUSES` by hand**, `page.tsx:37-47`), `isLastQuestionBeforeBreak` (`page.tsx:412-419`) | view + `activeQuizRounds` (`page.tsx:269-271`) |
| **REST data** (2) | `activeQuizId`, `activeQuizTitle` | `page.tsx:266-268` |
| **Connection state** (1) | `connectionError` | `useAdminGame`, `use-admin-game.ts:27` |
| **Action callbacks** (6) | `onAction` (= `sendAction`), `onKickTeam`, `onSetBreakEndTime`, `onSetDisplayTextScale`, `onCreateShowdownRound` (all socket emits from `useAdminGame`, `use-admin-game.ts:37-53`); `onCloseSession` (a REST mutation, `page.tsx:277-293`) | |

Observations:

1. **One object spread into five props.** `progress` becomes `progressStatus`/`roundIndex`/`questionIndex`/`isLeaderboardVisible`/`isMediaFullscreen` (`page.tsx:425-427,437,440`). The leaf panels then take them back as separate props again.
2. **Client derivations duplicated in /remote.** `canReplayMedia` (`remote/page.tsx:178-180`), `showAnswerStatus` (`remote/page.tsx:181-182`) and `leaderboardTeamCount` (`remote/page.tsx:188-191`) are the same expressions as `page.tsx:400-401,406-409,306-309`. /remote's own comment points back at /control's "matching computation" (`remote/page.tsx:186-187`).
3. **Server rules re-implemented on the client.** `SHOWDOWN_ELIGIBLE_STATUSES` is described as "Mirrors the backend's block-grading GRADED_STATUSES" (`page.tsx:37-39`). CLAUDE.md's model is that the admin view carries what `/control` needs, "plus server-decided Advance/Previous availability" (`screen-projection.util.ts:50-57`). `canAdvance`/`canGoToPreviousQuestion` were already moved server-side for that reason (`.scratch/overview.md`, screen-projection 05). `isShowdownEligible` and `isLastQuestionBeforeBreak` fit the same category.
4. **The callback types lose the ack.** The sidebar types callbacks as returning `void` (`admin-sidebar-props.ts:28,33,35,38`), while the hook returns `Promise<AckResult>` (`use-admin-game.ts:37-48`). This is assignable, so it compiles, but a leaf can't await the result without widening the type again. `ShowdownPanel` already had to be typed with `Promise<AckResult>` for exactly that reason (`showdown-panel.tsx:14-18`).
5. **Possible redundant REST derivation.** `roundTitles` for `TeamsTable` is built from the REST quiz list (`page.tsx:272-275`), while the snapshot already carries `roundTitles` (`shared/types/src/socket-events.ts:202-203`). Before swapping, check that they are equivalent for the active quiz. Not a sidebar prop, but it lives in the same derivation block.

---

## 3. Options, against primary sources

### A. Pass one domain object instead of spreading its fields

- Source: react.dev, "Passing Props to a Component". Spreading is fine, but "**Use spread syntax with restraint.** If you're using it in every other component, something is wrong. Often, it indicates that you should split your components and pass children as JSX." (https://react.dev/learn/passing-props-to-a-component#forwarding-props-with-the-jsx-spread-syntax). The same page also says "There's nothing wrong with repetitive code—it can be more legible."
- TS: `Pick<Type, Keys>` "Constructs a type by picking the set of properties Keys … from Type" (https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys). So a prop can be typed `Pick<AdminStatePayload, 'progress' | 'teams' | …>` rather than re-declaring fields that are already in shared types.
- Re-render tradeoff: react.dev's `memo` page recommends passing individual values rather than objects **when you rely on `memo`**, because `Object.is({}, {})` is false (https://react.dev/reference/react/memo#minimizing-props-changes). /control uses no `memo`, and the React Compiler is not enabled (`apps/frontend/next.config.ts` sets only `allowedDevOrigins`). Every `STATE_UPDATED` replaces the snapshot (`use-game-connection.ts:93-95`) and re-renders the page and both sidebars regardless. **So object props cost nothing here.**
- Fit with the projection: good. The view types (`AdminStatePayload`, `GameProgress`, `AdminIndicators`) are the server contract. Passing them through unchanged keeps the leaves speaking the projection's vocabulary instead of renamed copies (for example, `displayQuestionId` vs `onDisplayQuestionId`, `page.tsx:197-199`).
- Testability: page tests build views through `adminView()` (`test-utils.tsx:114-132`), so nothing changes for them. Leaf tests (`teams-panel.test.tsx`, `showdown-panel.test.tsx`) would pass a `progress(...)` fixture, which already exists at `test-utils.tsx:38-48`.
- Caveat: the page currently applies fallback defaults while destructuring (`teams = []`, `displayTextScale = DEFAULT_DISPLAY_TEXT_SCALE`, …, `page.tsx:369-383`), although these fields are non-optional in the type (`socket-events.ts:244,253,271,308`). Passing the view through drops those defensive defaults. That is fine if fixtures are complete (the `adminView` helper would need to fill them).

### B. Group callbacks into one `actions` object, or one dispatch function

- Source: react.dev "Scaling Up with Reducer and Context" contrasts `<TaskList tasks onChangeTask onDeleteTask />` with passing a single `dispatch` (https://react.dev/learn/scaling-up-with-reducer-and-context).
- This codebase: `sendAction(action: GameAction)` is **already** a dispatch function for every state-machine action (`use-admin-game.ts:125-131`). The other five actions are distinct socket events with distinct payload types (`use-admin-game.ts:133-184`). Folding them into one `AdminCommand` union would mean redesigning the hook API with no user-facing gain.
- Grouping them as `actions: Pick<UseAdminGameResult, 'sendAction' | 'kickTeam' | …> & { closeSession(): void }` is cheap and keeps each action's own types, including `Promise<AckResult>` (which fixes observation 4). All hook actions are already `useCallback`-stable (`use-admin-game.ts:116-188`). `handleCloseSession` is not (`page.tsx:290-293`), which only matters if the object ends up in a context value (option D).
- Recommended: group, don't dispatch-ify.

### C. Derive once: move client derivations into a single pure function (or into the projection)

- Source: react.dev "You Might Not Need an Effect": "When something can be calculated from the existing props or state, don't put it in state. Instead, calculate it during rendering." (https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state). "Choosing the State Structure": "Avoid duplication in state … it is difficult to keep them in sync." (https://react.dev/learn/choosing-the-state-structure#principles-for-structuring-state). The page already follows the first rule. The problem is the **duplication across /control and /remote** (section 2, observation 2), not where the values are computed.
- **C1: client selector.** One pure function, for example `deriveAdminControls(view, activeQuizRounds)`, returns `{ canStartQuiz, canEndQuiz, canCloseSession, canReplayMedia, showAnswerStatus, leaderboardStepCount, isShowdownEligible, isLastQuestionBeforeBreak, tiedTeamNames }`. /control and /remote both call it. It is unit-testable in Vitest without rendering. Its inputs already exist on both pages (/remote doesn't fetch the quiz list, so the REST-dependent pair would be `null`/`false` there, or split out).
- **C2: projection.** Add the same fields to `AdminStatePayload`, computed in `projectScreen`'s admin branch (`screen-projection.util.ts:50-57`), next to `getActionAvailability`. This matches CLAUDE.md ("each room gets its own view … server-decided Advance/Previous availability") and removes the hand-mirrored `SHOWDOWN_ELIGIBLE_STATUSES` (`page.tsx:37-47`). The cost is a shared-types change, a backend change with its specs, and a new fixture default in `test-utils.tsx` (the existing `defaultActionAvailability` at `test-utils.tsx:88-105` shows the pattern, and also shows the cost: the fixture re-implements a server rule).
- Suggested split: C2 for the two that re-state server knowledge (`isShowdownEligible`, `isLastQuestionBeforeBreak`, which need the session's rounds and grading state that the server owns). C1 for the purely presentational ones (`showAnswerStatus`, `canReplayMedia` via `isYoutubeMediaUrl`, `leaderboardStepCount`, `tiedTeamNames`, and the three status checks). Either variant is a prerequisite for a small sidebar interface, because it turns 9 loose flags into one `controls` object.

### D. Context provider scoped to /control (ticket 05's choice)

- Source: react.dev "Passing Data Deeply with Context", "Before you use context": "**Just because you need to pass some props several levels deep doesn't mean you should put that information into context.**" It advises "Start by passing props … it makes it very clear which components use which data!", then "Extract components and pass JSX as children", then "If neither of these approaches works well for you, consider context." It also says: "if some information is needed by distant components in different parts of the tree, it's a good indication that context will help you." (https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context)
- Re-render: "React automatically re-renders all the children that use a particular context starting from the provider that receives a different value … Skipping re-renders with memo does not prevent the children receiving fresh context values." (https://react.dev/reference/react/useContext#caveats). Here the provider would sit in `AdminPageContent`, which re-renders on every snapshot anyway, and the value changes on every snapshot. **So context gives no re-render benefit and no penalty compared with props.** Splitting state from actions into two contexts, as react.dev does with `TasksContext`/`TasksDispatchContext` (https://react.dev/learn/scaling-up-with-reducer-and-context), would only pay off if some consumer read actions alone. The repo already has that split as a precedent (`lib/player-menu-context.tsx:21-25`). The value object should be `useMemo`'d per https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions if the actions half is split out.
- "Fails with a clear developer error outside the provider" (ticket 05 acceptance): react.dev says "If you don't have any meaningful default value, specify null" (https://react.dev/reference/react/createContext#parameters). A reading hook can then throw on `null`. `AuthContext` already does this (`lib/use-auth.ts:153,160`). In React 19 (`apps/frontend/package.json:27`), the provider is rendered as `<ControlPanelContext value={…}>` (https://react.dev/reference/react/createContext#provider).
- Next.js: context works only in Client Components ("React context is not supported in Server Components", and providers should be rendered "as deep as possible in the tree", https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers). /control's page is already `'use client'` (`page.tsx:1`), so the provider can live inside `AdminPageContent`. No boundary issue arises.
- Fit for THIS tree: the consumers are exactly **two components one level below the page**. That is the case react.dev says to handle with props, not "distant components in different parts of the tree". The spec keeps the leaf panels prop-driven so /remote can reuse them (`spec.md:126,170`). So context would serve one hop only. What it really buys is not writing the list twice in `page.tsx`, and a single prop does that too.
- Testability: page tests are unaffected either way (they mock the hook, not the sidebars). A context adds one failure mode (rendering a sidebar outside the provider) that props don't have.

### E. Sidebars call a custom hook themselves (`useAdminGame`)

- Source: "Custom Hooks let you share stateful logic but not state itself. Each call to a Hook is completely independent from every other call to the same Hook." (https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself)
- This codebase: `useGameConnection` creates a new `io()` socket per call (`use-game-connection.ts:79-113`). Calling `useAdminGame` from both sidebars would open **three admin sockets**, each with its own snapshot. **Ruled out.** The only viable form of "the component calls a hook" is a hook that reads a context, which is option D.

### F. Composition: children or slots

- Source: react.dev "Before you use context" #2: "If you pass some data through many layers of intermediate components that don't use that data (and only pass it further down), this often means that you forgot to extract some components along the way … make `Layout` take `children`" (https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context). Also see "Passing JSX as children" (https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children). This describes the sidebars exactly: they don't use their props.
- The codebase already does this in one place: `NavigationButtons` takes `children` as a slot, and /remote fills it with `MediaFullscreenToggle`/`ReplayMediaButton` (`navigation-buttons.tsx:17-18`, `remote/page.tsx:271-285`).
- Sketch: the page renders the panels once and hands them to two layout shells, `<DesktopSidebar status={…} actions={…} teams={…} />`, and the same element values to `MobileAdminBar`.
- Obstacles in this code:
  1. The mobile drawer wraps `onAction`/`onCloseSession` to close itself (`mobile-admin-bar.tsx:63-71`). A pre-built `<AdminActions onAction={sendAction}>` element can't know about the drawer. It would need a render prop (`renderActions(onDone)`) or a small drawer-close context, which brings back the indirection.
  2. The two layouts order and include panels differently: mobile puts `NavigationButtons` outside the drawer with `className="flex-1"` (`mobile-admin-bar.tsx:154-163`), and desktop puts it first inside `<aside>` (`desktop-sidebar.tsx:57-66`).
- Verdict: the most "React-idiomatic" removal of the pass-through layer, but the drawer coupling makes the API clunkier than one grouped prop. Worth it only if the two layouts diverge further.

### G. Split the component

The sidebars are already split into eight leaf panels (section 1). Splitting further doesn't reduce the interface, because the width comes from the shell forwarding everything. Not applicable.

---

## 4. Recommendation per offender

### 1-2. `AdminSidebarProps` / `MobileAdminBarProps` (34 / 32)

Do these in order. Each step works on its own.

1. **Group, via A + B + C1.** Replace the flat fields with grouped members built by one pure function in `control/` (for example, `buildControlPanel(view, quizzes, connectionError, actions)`), shared with /remote for the overlapping flags. That takes 32 flat fields to 7 grouped members, and fixes the `void`-vs-`Promise<AckResult>` typing.
2. **Deliver the object.** Either:
   - one prop (`panel={panel}`) passed to both sidebars, which is react.dev's default ("start by passing props") and needs no provider or guard; or
   - ticket 05's context, carrying **the same object**. Choose this only if "no prop lists in /control" (spec user story 32, `spec.md:69`) is meant literally, or if leaf panels are later allowed to read it.
3. **Move the server-knowledge flags into the projection (C2)**, as a follow-up. `isShowdownEligible` and `isLastQuestionBeforeBreak` then come from `AdminStatePayload`, and `SHOWDOWN_ELIGIBLE_STATUSES` (`page.tsx:40-47`) is deleted.
4. `MobileAdminBar`'s extra `user`/`onLogout`: the bar can call `useAuth()` directly, since it is already a context (`lib/use-auth.ts:153-160`) and the page just forwards `auth.user` (`page.tsx:457-458`). Only `onLogout`'s router push stays page-specific. Alternatively, keep both as the bar's own layout props, which ticket 05 already allows ("The mobile bar keeps only its own layout props").

**Before (today, `admin-sidebar-props.ts:10-48`), 32 flat fields:**

```ts
export interface AdminSidebarProps {
  progressStatus: GameStatus; roundIndex: number; questionIndex: number;
  joinCode: string; activeQuizId: number | null; activeQuizTitle: string | null;
  connectionError: string | null;
  canStartQuiz: boolean; canGoToPreviousQuestion: boolean; canAdvance: boolean;
  canEndQuiz: boolean; canCloseSession: boolean;
  isLeaderboardVisible: boolean; leaderboardRevealCount: number; leaderboardTeamCount: number;
  isMediaFullscreen: boolean; canReplayMedia: boolean;
  onAction: (action: GameAction) => void; onCloseSession: () => void;
  teams: TeamView[]; showAnswerStatus: boolean; answeredTeamIds: number[];
  onKickTeam: (teamId: number) => void;
  breakEndsAt: number | null; onSetBreakEndTime: (breakEndsAt: number | null) => void;
  isLastQuestionBeforeBreak: boolean;
  displayTextScale: number; onSetDisplayTextScale: (displayTextScale: number) => void;
  activeShowdown: ActiveShowdownView | null; tiedTeamNames: string[];
  isShowdownEligible: boolean;
  onCreateShowdownRound: (question: string, answer: string, points: number) => Promise<AckResult>;
}
```

**After (sketch), 7 grouped members, each reusing an existing type:**

```ts
/** Server-view slice the sidebars show, unchanged from the admin projection. */
type ControlPanelView = Pick<
  AdminStatePayload,
  | 'progress'               // replaces progressStatus/roundIndex/questionIndex/isLeaderboardVisible/isMediaFullscreen
  | 'joinCode' | 'teams' | 'answeredTeamIds'
  | 'breakEndsAt' | 'displayTextScale' | 'activeShowdown'
  | 'leaderboardRevealCount'
  | 'canAdvance' | 'canGoToPreviousQuestion'
>;

/** Every "can I / should I show" flag, derived once (C1) or projected by the server (C2). */
export interface ControlPanelControls {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  canReplayMedia: boolean;
  showAnswerStatus: boolean;
  leaderboardStepCount: number;       // was leaderboardTeamCount
  isLastQuestionBeforeBreak: boolean; // C2 candidate
  isShowdownEligible: boolean;        // C2 candidate
  tiedTeamNames: string[];
}

/** Socket actions keep the hook's own signatures, acks included. */
export type ControlPanelActions = Pick<
  UseAdminGameResult,
  'sendAction' | 'kickTeam' | 'setBreakEndTime' | 'setDisplayTextScale' | 'createShowdownRound'
> & { closeSession: () => void };

export interface ControlPanel {
  view: ControlPanelView;
  quiz: { id: number | null; title: string | null }; // REST, not socket
  connectionError: string | null;
  controls: ControlPanelControls;
  actions: ControlPanelActions;
}

// Delivery, option 1 (props):   function DesktopSidebar({ panel }: { panel: ControlPanel })
// Delivery, option 2 (ticket 05): const panel = useControlPanel(); // throws outside the provider
```

The leaf panels keep their own prop interfaces (spec constraint, `spec.md:126`). Inside the sidebar, the forwarding becomes, for example, `progressStatus={panel.view.progress.status}`. Optionally, `NavigationButtons`/`BreakEndTimeControl`/`SessionStatusPanel` could later accept `progress: GameProgress` directly. /remote already holds a `progress` (`remote/page.tsx:165`), so that is cheap there too.

### Where this differs from ticket 05

Ticket 05 (`.scratch/role-socket-hooks/issues/05-control-panel-context.md:7-17`) lists the context's content as the same flat set of values ("status, round and question indices, join code and quiz; connection error; the can-do flags; …"). Implemented literally, that moves the 32 fields from an interface into a context value type. "A new control" still costs a field in the value, a line in the page and a line in each sidebar. That is three places instead of four, not one. The primary sources (react.dev "Before you use context") favour props or composition for a one-hop, two-consumer case. **Suggestion:** keep ticket 05's goals and acceptance criteria, but land the grouping (steps 1 and 3 above) first, and let the context (if kept) hold `ControlPanel`. This is flagged, not silently overridden. The final call is the team's.

### 3. `QuestionDisplayProps` (15)

Every call site spreads a question's fields (`display/page.tsx:347-356`, `question-open-screen.tsx:34-41`, `break-review-screen.tsx:21-28`, `play/question-browser.tsx:115-121`). Recommend one `question` prop typed as `Pick<QuestionView, 'type' | 'prompt' | 'options' | 'matchTargets' | 'mediaUrl' | 'mediaStartSeconds' | 'mediaEndSeconds'> & Partial<Pick<RevealQuestionView, 'answer' | 'answerMediaUrl'>>` (types at `shared/types/src/socket-events.ts:83-110`). The presentation props (`mediaTestIdPrefix`, `autoplayMedia`, `promptClassName`, `isFullscreen`, `mediaReplayToken`, `playerAnswer`) stay separate, which gives about 7 props. Watch out for two things:

- /play deliberately omits media (`play/question-browser.tsx:115-124`), so it would need an explicit `showMedia={false}` or a stripped object.
- `answer` is renamed `correctAnswer` today.

Medium priority. The payoff is at the 4 call sites, not the interface.

### 4. `GameStatusScreensProps` (14), and `RulesContent`

`rules`, `enabledBonusCategories`, `maxPlayersPerTeam` and `extraPlayerPenaltyPoints` are `settings.*` spread at `play/page.tsx:400-403`, forwarded untouched to `RulesContent` (`game-status-screens.tsx:81-87`). They are spread identically at the two other `RulesContent` call sites (`display/page.tsx:236-242`, `rules/page.tsx:41-49`). Recommend `RulesContent` take `settings?: Pick<SessionSettings, 'rules' | 'enabledBonusCategories' | 'maxPlayersPerTeam' | 'extraPlayerPenaltyPoints'>` (`SessionSettings` at `socket-events.ts:602`). `GameStatusScreens` would take the same `settings`. That makes 14 → 11, and 5 → 2 on `RulesContent`. `myTeamId` is derived from `team` (`play/page.tsx:243`) and could be computed inside, but it is harmless. Low effort, clear win.

### 5. `QuestionBrowserProps` (/play, 14)

Mostly distinct inputs, crossing one layer, and it already groups navigation (`question-browser.tsx:16-21`). **Leave as is.** Optionally, `isKahootMode` and `isAnswerable` are view fields and could come with a `Pick<PlayersStatePayload, …>`, but the gain is small.

### 6. `QuestionBrowserPanelProps` (/control, 13)

- `displayQuestionId`/`displayTitleRoundIndex`/`displayBreakRoundIndex` are `AdminIndicators` renamed on the way in (`page.tsx:197-199` ← `on-air-screen.ts:227-234`). Pass `indicators: AdminIndicators` instead.
- `liveAnswers`/`teams`/`onGrade` are only forwarded to `AnswersPanel` (`question-browser-panel.tsx:190-196`). That is the react.dev children case: the page could pass the `<AnswersPanel …/>` element as an `answers` slot. The page would then compute `hasLiveAnswers` itself (today at `question-browser-panel.tsx:99`).

The first change is cheap and aligns with the projection. The second is optional. Together they give 13 → 8.

### 7-8. Quiz editors (12 / 11)

Inputs are distinct, cross one layer, and the four row callbacks are closures over the row id (`quiz-round-editor.tsx:271-274`, `quiz-editor-panel.tsx:571-574`). `isFirst`/`isLast` are derivable from `index` plus a count, but passing them is clearer than passing the count. react.dev: "it's not unusual to pass a dozen props … it makes it very clear which components use which data" (https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context). **Leave as is.**

### 9. `JoinFormProps` (10)

Three controlled value/onChange pairs lifted to the page, which needs them (join flow, URL prefill). **Leave as is.** A `values` + `onChange(field, value)` pair would save 3 fields and cost type precision.

### Leaf panels (`NavigationButtons`, `AdminActions`, 9 each)

Shared with /remote and kept prop-driven by the spec (`spec.md:126,170`). **Leave as is.** Optionally they could accept `progress: GameProgress` once the sidebars pass it (see above).

---

## 5. Sources

Primary (fetched 2026-10-01):

- react.dev, Passing Data Deeply with Context, "Before you use context" / "Use cases for context": https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context
- react.dev, Scaling Up with Reducer and Context (separate state and dispatch contexts, provider file, custom reading hooks): https://react.dev/learn/scaling-up-with-reducer-and-context
- react.dev, Reusing Logic with Custom Hooks ("share stateful logic but not state itself"): https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself
- react.dev, Passing Props to a Component (spread with restraint; JSX as children): https://react.dev/learn/passing-props-to-a-component#forwarding-props-with-the-jsx-spread-syntax
- react.dev, You Might Not Need an Effect ("calculate it during rendering"): https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state
- react.dev, Choosing the State Structure (avoid redundant/duplicated state): https://react.dev/learn/choosing-the-state-structure#principles-for-structuring-state
- react.dev, `useContext` (re-render caveat, `Object.is`, `memo` doesn't help, memoizing the value): https://react.dev/reference/react/useContext#caveats
- react.dev, `createContext` (React 19 `<Ctx value>` provider, `null` default): https://react.dev/reference/react/createContext
- react.dev, `memo` (minimizing props changes; don't memo everywhere): https://react.dev/reference/react/memo#minimizing-props-changes
- TypeScript Handbook, Utility Types (`Pick`, `Omit`, `Partial`): https://www.typescriptlang.org/docs/handbook/utility-types.html
- Next.js, Server and Client Components, "Context providers" and the `'use client'` boundary: https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers

Codebase: file:line references inline above (paths relative to `apps/frontend/app/` unless prefixed by `shared/`, `apps/backend/` or `.scratch/`).
