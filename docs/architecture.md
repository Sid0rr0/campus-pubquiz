# Architecture Diagrams

Diagrams of how the system is put together. They show structure; the
behaviour behind them (statuses, protocol, persistence rules) is described in
[`DOCUMENTATION.md`](../DOCUMENTATION.md), and domain terms are defined in
[`GLOSSARY.md`](../GLOSSARY.md).

The diagrams are Mermaid: GitHub renders them, and VS Code does with the
"Markdown Preview Mermaid Support" extension (`bierner.markdown-mermaid`).
They are hand-maintained — a change that moves a module, adds an entity or
changes a flow drawn here updates the diagram in the same commit.

- [System context](#system-context)
- [Workspaces](#workspaces)
- [Backend modules](#backend-modules)
- [Event flow: a team submits an answer](#event-flow-a-team-submits-an-answer)
- [Event flow: the quiz master presses Advance](#event-flow-the-quiz-master-presses-advance)
- [Game status machine](#game-status-machine)
- [Data model](#data-model)
- [Frontend modules](#frontend-modules)

## System context

```mermaid
flowchart LR
  subgraph venue["At the venue"]
    tv["Big screen<br/>/display"]
    laptop["Quiz master laptop<br/>/control, /remote"]
    phones["Team phones<br/>/play"]
  end
  mgmt["Admins & moderators<br/>/sessions, /quizzes, /stats, /users"]

  fe["Frontend<br/>Next.js 16 · :8888"]
  be["Backend<br/>NestJS 11 + Socket.IO · :3000<br/>single instance"]
  db[("Postgres")]
  blob["Vercel Blob<br/>(media uploads)"]
  sheets["Google Sheets<br/>(CSV import)"]
  sentry["Sentry"]

  tv & laptop & phones & mgmt -->|pages| fe
  tv & laptop & phones <-->|"Socket.IO<br/>intents ↑ · per-room views ↓"| be
  laptop & mgmt -->|"REST (session cookie)"| be
  be --> db
  be --> blob
  be -->|fetch CSV export| sheets
  fe -.-> sentry
  be -.-> sentry
```

The browser talks to the backend directly — the Next.js app serves pages but
does not proxy the game. The backend is the only writer of game state.

## Workspaces

```mermaid
flowchart TD
  types["shared/types<br/>@campus-pubquiz/types<br/>state machine · socket contract · Zod schemas · DTOs"]
  backend["apps/backend"]
  frontend["apps/frontend"]
  backend --> types
  frontend --> types
```

`shared/types` is the only code both apps share, and it resolves through its
built `dist/` — build it first (`pnpm build` does, in topological order).

## Backend modules

Arrows point from caller to callee. Everything below the transport layer is
reached through `GameStateService` for live sessions, or directly by the REST
controllers for authoring, stats and administration.

```mermaid
flowchart TD
  subgraph transport["Transport"]
    gw["GameGateway<br/>game/game.gateway.ts"]
    rest["REST controllers<br/>auth · users · sessions · quiz · import<br/>media · answer · teams · bonus · stats"]
  end

  subgraph socket["game/socket — event plumbing"]
    dispatch["dispatchSocketEvent<br/>validate → find session → check room<br/>→ run the event's one Live session call → deliver"]
    deliver["deliverOutcome<br/>re-arm timers from the outcome's deadline change<br/>replies · broadcast · admin answer lists<br/>team syncs · socket closes"]
    broadcast["broadcastGameState<br/>one view per room"]
    timers["question-lock timer registry"]
  end

  subgraph state["game/state — the live session module"]
    gss["GameStateService"]
    queue["SessionWriteQueue<br/>one write at a time per join code"]
    store["GameSessionStore<br/>in-memory SessionState"]
    mover["MoveCommitter<br/>plan → grade → settle → save"]
    grading["BlockGradingService"]
    progress["GameProgressRepository"]
  end

  subgraph shared["shared/types — pure rules"]
    project["projectScreen<br/>per-room views"]
    plan["Move plan<br/>what one press does"]
  end

  subgraph domain["Domain services"]
    answer["AnswerService"]
    team["TeamService"]
    bonus["BonusService"]
    feedback["FeedbackService"]
    showdown["ShowdownService"]
    standings["StandingsService"]
    quiz["QuizService · ImportService"]
    media["MediaService"]
    stats["StatsService"]
    auth["AuthModule<br/>SessionService · guards"]
  end

  repos["db/repositories<br/>one per entity (MikroORM)"]
  db[("Postgres")]

  gw --> dispatch --> gss
  dispatch --> deliver --> broadcast --> project
  deliver -->|"deadline change: re-arm"| timers
  timers -->|"expiry = ADVANCE press, delivered like any event"| gw
  rest -->|"notify* after live edits"| gw
  rest -->|read-only lookups| gss
  rest --> domain

  gss --> queue --> store
  gss --> mover --> grading
  mover --> progress
  mover --> plan
  gss --> project
  fixtures["frontend test fixtures<br/>test-utils/room-view.ts"] --> project
  gss -->|"answers · roster · bonuses<br/>showdown · standings"| domain

  domain --> repos
  progress --> repos
  repos --> db
```

Key seams:

- **`dispatchSocketEvent`** is the single template every client-to-server
  event goes through, so rejection order never varies and refusals become
  socket errors in one place.
- **`GameStateService.writeSession`** is the only way a live session changes:
  queued per join code, applied to the session as the previous write left it,
  ends with a standings read, then stored.
- **`MoveCommitter`** is the only place a press (admin action, timer expiry,
  session creation, restart restore) is planned, graded, settled and saved.
- **`projectScreen`** builds each room's view, so nothing a room hasn't been
  shown ever leaves the server. It lives in `shared/types` with the Move plan
  and the other pure rules it reads; the backend calls it, and the frontend's
  test fixtures (`apps/frontend/test-utils/room-view.ts`) run the same
  projection.

## Event flow: a team submits an answer

```mermaid
sequenceDiagram
  autonumber
  participant P as Phone (/play)
  participant GW as GameGateway
  participant D as dispatchSocketEvent
  participant GS as GameStateService
  participant AS as AnswerService
  participant Q as SessionWriteQueue
  participant ST as StandingsService
  participant DB as Postgres
  participant R as Rooms (display / admin / players)

  P->>GW: SUBMIT_ANSWER {teamId, questionId, value}
  GW->>D: dispatch(declaration, payload)
  D->>D: Zod-parse · resolve join code · check players room
  D->>GS: submitAnswer(joinCode, payload, socketId)
  GS->>GS: question still open? socket owns team?
  GS->>AS: submit(...) — grades auto-gradable types
  AS->>DB: upsert answer (last write wins)
  GS->>Q: writeSession(joinCode, change)
  Q->>AS: listForQuestion → answered team ids
  Q->>ST: leaderboard(gameSessionId)
  ST->>DB: read standings
  Q-->>GS: store new SessionState
  GS-->>D: SessionOutcome
  D->>P: ANSWER_RECEIVED (sender only)
  D->>R: STATE_UPDATED (each room its own view)
  D->>R: ANSWERS_UPDATED (admin room only)
  D-->>P: ack
```

## Event flow: the quiz master presses Advance

```mermaid
sequenceDiagram
  autonumber
  participant C as /control or lock timer
  participant GW as GameGateway
  participant GS as GameStateService
  participant Q as SessionWriteQueue
  participant MC as MoveCommitter
  participant BG as BlockGradingService
  participant PR as GameProgressRepository
  participant ST as StandingsService
  participant R as Rooms

  C->>GW: ADMIN_ACTION ADVANCE (or timer expiry)
  GW->>GS: applyAdminAction(joinCode, action)
  GS->>Q: writeSession
  Q->>MC: commit(session, action)
  MC->>MC: planMove — legal transition?
  MC->>BG: ungraded answers in block? (refuses leaving the break)
  MC->>PR: save progress row
  MC-->>Q: {session, outcome}
  Q->>ST: leaderboard
  Q-->>GS: store session
  GS-->>GW: SessionOutcome (or SessionRefusal)
  GW->>GW: re-arm the auto-lock timers if the outcome carries a deadline change
  GW->>R: PRESENTER_CONTEXT_UPDATED (admin) + STATE_UPDATED (per room)
  GW->>R: TEAM_ANSWERS_SYNCED (each team, on reveal entry)
```

## Game status machine

`ADVANCE` moves forward; `PREVIOUS` walks the same path backward. The full
behaviour of each status is the table in
[DOCUMENTATION.md → Statuses](../DOCUMENTATION.md#statuses).

```mermaid
stateDiagram-v2
  direction LR
  [*] --> lobby
  lobby --> rules: START_QUIZ
  rules --> round_overview
  rules --> round_intro: overview off
  round_overview --> round_intro

  state "answering" as answering {
    round_intro --> question_open
    question_open --> question_open: next question
    question_open --> round_intro: next round in block
    question_open --> locking: block's last question
  }

  locking --> break_intro: block locks
  locking --> reveal: kahoot round

  state "break" as breakGroup {
    break_intro --> break: PREVIOUS (break review)
    break --> break_round_intro: PREVIOUS across a round
    break_round_intro --> break
  }

  break_intro --> reveal_intro: all graded
  break --> reveal_intro: all graded

  state "revealing" as revealing {
    reveal_intro --> reveal
    reveal --> reveal: next question
    reveal --> reveal_intro: round boundary
  }

  reveal --> round_intro: next block
  reveal --> ended: last round
  ended --> [*]
```

`END_QUIZ` jumps to `ended` from anywhere; the leaderboard is a flag, not a
status.

## Data model

```mermaid
erDiagram
  QUIZ ||--o{ ROUND : has
  ROUND ||--o{ QUESTION : has
  QUIZ ||--o{ GAME_SESSION : "played as"

  GAME_SESSION ||--o{ GAME_SESSION_TEAM : roster
  TEAM ||--o{ GAME_SESSION_TEAM : "plays in"

  GAME_SESSION ||--o{ ANSWER : ""
  QUESTION ||--o{ ANSWER : ""
  TEAM ||--o{ ANSWER : ""

  GAME_SESSION ||--o{ BONUS_AWARD : ""
  TEAM ||--o{ BONUS_AWARD : ""

  GAME_SESSION ||--o{ ROUND_RATING : ""
  ROUND ||--o{ ROUND_RATING : ""
  TEAM ||--o{ ROUND_RATING : ""

  GAME_SESSION ||--o{ SESSION_FEEDBACK : ""
  TEAM ||--o{ SESSION_FEEDBACK : ""

  GAME_SESSION ||--o{ SHOWDOWN_ROUND : ""
  SHOWDOWN_ROUND ||--o{ SHOWDOWN_ROUND_TEAM : ""
  TEAM ||--o{ SHOWDOWN_ROUND_TEAM : ""
  TEAM |o--o{ SHOWDOWN_ROUND : wins

  USER ||--o{ SESSION : "logged in as"

  QUESTION {
    string type
    json payload "per-type, Zod-validated"
  }
  GAME_SESSION {
    string joinCode
    string status
    int currentRoundIndex
    int currentQuestionIndex
  }
```

Authoring time is `QUIZ → ROUND → QUESTION`; everything hanging off
`GAME_SESSION` is runtime. `SESSION` is a login session, not a game session.
Entities: `apps/backend/src/db/entities/`.

## Frontend modules

```mermaid
flowchart TD
  subgraph live["Live game routes"]
    display["/display"]
    control["/control"]
    remote["/remote"]
    play["/play"]
  end
  subgraph manage["Management routes"]
    pages["/sessions · /quizzes/[id] · /stats<br/>/teams · /users · /login · /register"]
  end

  useDisplay["useDisplayGame"]
  useAdminSession["useAdminSession"]
  useAdmin["useAdminGame"]
  teamLink["Team link module<br/>plain TS: events + intents in, state + commands out"]
  useTeamLink["useTeamLink<br/>adapter: socket, timer, storage, router, toasts"]
  useAuth["useAuth"]
  conn["useGameConnection<br/>socket.io-client · STATE_SYNC on connect"]
  api["lib/*-api.ts<br/>fetch + TanStack Query"]
  storage["team-storage<br/>localStorage token"]
  types["@campus-pubquiz/types"]
  be["Backend"]

  display --> useDisplay --> conn
  control & remote --> useAdminSession --> useAdmin --> conn
  useAdminSession --> useAuth
  play --> useTeamLink --> conn
  useTeamLink --> teamLink
  useTeamLink --> storage
  rules["/rules"] --> conn
  pages --> api
  control --> api
  useAuth --> api
  conn -->|Socket.IO| be
  api -->|REST| be
  conn & api -.-> types
```

Every live route renders the view its room receives and sends intents —
it never advances the game or decides what to show on its own.
