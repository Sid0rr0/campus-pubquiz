# Campus Pub Quiz — How It Works

A live pub quiz web app for campus events. One machine shows questions on a big
screen, teams answer on their phones, and the quiz master runs the game from a
laptop. This document describes the system as currently built.

## Contents

- [Campus Pub Quiz — How It Works](#campus-pub-quiz--how-it-works)
  - [Contents](#contents)
  - [System Overview](#system-overview)
  - [The Three UIs](#the-three-uis)
  - [Other Routes: Auth, Sessions, and Quiz Authoring](#other-routes-auth-sessions-and-quiz-authoring)
  - [Game Flow: Rounds, Blocks, and the State Machine](#game-flow-rounds-blocks-and-the-state-machine)
    - [Statuses](#statuses)
    - [Admin actions](#admin-actions)
  - [Real-Time Protocol (Socket.IO)](#real-time-protocol-socketio)
    - [The snapshot](#the-snapshot)
    - [Events](#events)
  - [Answer Lifecycle](#answer-lifecycle)
  - [Teams: Join, Reconnect, and Kick](#teams-join-reconnect-and-kick)
  - [Question Types](#question-types)
  - [Quiz Authoring and CSV Import](#quiz-authoring-and-csv-import)
  - [Persistence and Restart Resilience](#persistence-and-restart-resilience)
  - [Authentication](#authentication)
  - [Sessions: Running Multiple Quizzes at Once](#sessions-running-multiple-quizzes-at-once)
  - [Session Stats](#session-stats)
  - [Deploy and CI](#deploy-and-ci)

## System Overview

```
apps/
  frontend/    Next.js 16, React 19, Tailwind 4 — three routes in one app (port 8888)
  backend/     NestJS 11 + Socket.IO — authoritative game state + Postgres (port 3000)
shared/
  types/       @campus-pubquiz/types — game state machine, socket contract, DTOs
```

The backend owns all game state. Clients never advance the game themselves —
they render snapshots the server broadcasts and send intents (join, answer,
grade, advance, kick, award bonus). A single backend instance serves everyone
and can run several game sessions concurrently, each bound to its own join
code and Socket.IO room set; at pub-quiz scale (dozens of teams per session)
this is intentional, so there is no Redis adapter and no horizontal scaling.

Everything important is written to Postgres as it happens; the in-memory state
is a cache that can be rebuilt after a restart.

## The Three UIs

| Route      | Who                  | What it does                                                                                                                                                                           |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/display` | Big screen (TV)      | If no session is picked, shows a session picker; otherwise the current status screen (lobby, rules, round intro, question, locking countdown, break intro, reveal, leaderboard, ended) |
| `/control` | Quiz master's laptop | Bound to one session via `?code=`; state machine controls, grading, teams roster (with kick), bonus awards                                                                             |
| `/play`    | Team phones          | Join by name + code (or reconnect via saved token/team code), browse open questions, submit and revise answers, review a running history of every question seen so far                 |

## Other Routes: Auth, Sessions, and Quiz Authoring

Beyond the three live-game surfaces, the same Next.js app serves the
management and authoring UI:

| Route            | Who                         | What it does                                                                    |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `/`              | Anyone                      | Landing page — team join panel, plus a "Quiz master login" link                 |
| `/login`         | Admin/moderator             | Session login; redirects to `/sessions` on success                              |
| `/register`      | Prospective admin/moderator | Self-registration; account is `pending` until an existing admin approves it     |
| `/sessions`      | Admin/moderator (any)       | Lists/starts/closes game sessions; opening one routes to `/control?code=...`    |
| `/control/users` | Admin only                  | Approve pending accounts, deactivate active ones                                |
| `/quizzes/[id]`  | Admin/moderator (any)       | Quiz create/edit page (`id === 'new'` for a blank draft); CSV import lives here |
| `/rules`         | Anyone, any time            | Standalone round/topic/break-structure page, computed from the active quiz      |

## Game Flow: Rounds, Blocks, and the State Machine

A quiz is a list of **rounds**, each holding ordered **questions**. Every round
has a `breakAfter` flag. The consecutive rounds between one `breakAfter: true`
round and the next form a **block** — the unit of locking and grading.

### Statuses

One block, forward with `ADVANCE`:

```text
lobby → rules → round_overview (optional)
  → round_intro → question_open … → locking            answering
  → break_intro  (break review: break ⇄ break_round_intro, via PREVIOUS)
  → reveal_intro → reveal …                            revealing
  → next block's round_intro … → ended
```

Meanings of these terms (block, break, break review, round title card,
status groups) live in [`CONTEXT.md`](CONTEXT.md); this table is the
behaviour of each status.

| Status              | Big screen                                                                                                                        | Phones                                                                                                                                                                 | Reached by                                                                                                                         | `ADVANCE` goes to                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `lobby`             | QR code and join code                                                                                                             | "Waiting for the quiz to start…" + rules link                                                                                                                          | Session created                                                                                                                    | — (`START_QUIZ` → `rules`)                                                                                             |
| `rules`             | Rules: round/topic/break structure + house rules, shown once per quiz                                                             | The same rules                                                                                                                                                         | `START_QUIZ`                                                                                                                       | `round_overview`, or `round_intro` if the overview is turned off                                                       |
| `round_overview`    | Every round's title (with category/author), shown once                                                                            | "Look at the screen — Rounds"                                                                                                                                          | `ADVANCE` from `rules`                                                                                                             | First round's `round_intro`                                                                                            |
| `round_intro`       | Round title card: "ROUND N — category", title, author                                                                             | "Look at the screen" + round title; the block browser instead if questions are already open                                                                            | `ADVANCE` from `round_overview`, from a round's last question when the block continues, or from the previous block's last `reveal` | That round's first `question_open`                                                                                     |
| `question_open`     | The current question (prompt + media)                                                                                             | Block browser: every question opened so far in the block, answerable (last write wins)                                                                                 | `ADVANCE` from `round_intro` or the previous question                                                                              | Next question; the next round's `round_intro` if the block continues; `locking` on the block's last question           |
| `locking`           | Countdown on the block's last question                                                                                            | Still answerable                                                                                                                                                       | `ADVANCE` from the block's last question                                                                                           | `break_intro` — the block locks; a kahoot round goes straight to `reveal`                                              |
| `break_intro`       | "BREAK N" card, break timer, bonus categories, and "Rate the rounds on your phone ★" when feedback is collected                   | Block browser, read-only                                                                                                                                               | The block locking                                                                                                                  | `reveal_intro` — refused while any answer in the block is ungraded                                                     |
| `break`             | One locked question under break review (prompt + media, no answer)                                                                | Block browser, read-only                                                                                                                                               | `PREVIOUS` from `break_intro` (lands on the block's last question) or from a later question                                        | The next question in the block; from the block's last question, `reveal_intro` (same ungraded check)                   |
| `break_round_intro` | Round title card: "ROUND N", title — no answers implied                                                                           | "Look at the screen" + round title                                                                                                                                     | `PREVIOUS` across the start of a round during break review                                                                         | Back into `break` on the same question                                                                                 |
| `reveal_intro`      | Round title card: "REVEALING ANSWERS · ROUND N", title                                                                            | "Look at the screen" + round title                                                                                                                                     | Leaving the break, or `ADVANCE` across the start of a round during the reveal                                                      | `reveal` on that round's first question                                                                                |
| `reveal`            | One question with its correct answer (and `answer_media_url`)                                                                     | Block browser with the team's answer, the correct answer and points                                                                                                    | `ADVANCE` from `reveal_intro` or the previous reveal question; `locking` in a kahoot round                                         | Next reveal question; `reveal_intro` at a round boundary; the next block's `round_intro`; `ended` after the last round |
| `ended`             | Final screen ("Quiz complete!" plus "Tell us what you thought — on your phone" when feedback is collected), or an active showdown | "Quiz complete!" followed by the final feedback form (every round with its stars) once any showdown is decided; or the showdown guess form / reveal while it is played | `ADVANCE` past the last reveal, or `END_QUIZ`                                                                                      | —                                                                                                                      |

`PREVIOUS` walks the same path backward, symmetrically, including back
across a block boundary into the previous block's `reveal`. During the
break it is how break review starts: from `break_intro` it shows the
block's last question, then steps back one question at a time, stopping on
a `break_round_intro` card at the start of each round (the quiz's first
round included), and from the block's first round card it crosses into the
previous block's `reveal`.

`break_round_intro` is deliberately a separate status from
`round_intro`/`reveal_intro`, even though all three draw a round title card:
those two treat their round as live (open for answering) or already
revealed — reusing either during break review would reopen a locked round
for answers or leak an unrevealed one.

Grading is not tied to a status. The admin can grade an answer as soon as it
arrives (a team revising an answer into something that doesn't match the key
clears its grade); the break is
where remaining grading must be finished, since leaving it is refused while
any answer in the block is ungraded. While one is, /remote's "next" line says
Advance is "Waiting for grading" (the Advance slot still shows Advance); it
switches to the reveal's round title card once the last answer is graded, and
follows a live answer-key fix that makes an answer ungraded or clears the last
one. The press itself re-reads the database, so a stale cache never lets it
through.

For a `closest_guess` question with at least one submitted guess,
`ADVANCE`/`PREVIOUS` in `reveal` first walk a 5-step cumulative reveal on that
one question (smallest guess → highest guess → correct answer → closest
team(s)) before falling through to the normal transition — see
[Question Types](#question-types) below. This sub-walk is ephemeral
(`closestGuessRevealStep` on the snapshot), not part of `GameProgress`.

There is **no per-question locking** — locking is purely a consequence of
finishing a `breakAfter` round. A `locked` status existed in an earlier
version of the schema; it is not part of the live state machine today (that
role is now split across `locking`/`break`). Any database row still carrying
the retired `locked` value is normalized to `question_open` on load — see
[Persistence](#persistence-and-restart-resilience).

The leaderboard is deliberately _not_ a status: `isLeaderboardVisible` is a
flag the admin can toggle from any status, so hiding it always resumes exactly
where the game was.

### Admin actions

| Action               | Legal from                              | Effect                                                                                          |
| -------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `START_QUIZ`         | `lobby`                                 | → `rules`                                                                                       |
| `ADVANCE`            | every status except `lobby` and `ended` | Steps forward per the table above, crossing block boundaries automatically                      |
| `PREVIOUS`           | most non-terminal statuses              | Symmetric backward walk, including back across a block boundary into the prior block's `reveal` |
| `END_QUIZ`           | any except `ended`                      | Force-end                                                                                       |
| `TOGGLE_LEADERBOARD` | any                                     | Flips `isLeaderboardVisible`, status untouched                                                  |

Grading (`GRADE_ANSWER`), kicking a team (`KICK_TEAM`), and awarding bonus
points (`AWARD_BONUS`) are **not** part of this state machine — they are
separate socket events that mutate `Answer`/`Team`/`BonusAward` rows directly
without a status transition.

The pure transition function `getNextGameState` lives in
`shared/types/src/game-state.ts`; illegal transitions throw and are surfaced
to the admin as socket exceptions. A config whose last round has
`breakAfter: false` is rejected outright (its answers could never be
revealed).

## Real-Time Protocol (Socket.IO)

Clients connect with `?role=display|admin|players`; rooms are scoped per game
session (`sessionRoom(joinCode, role)`, e.g. `admin:AB12CD`) so multiple
sessions can run concurrently without cross-talk. Admin connections (both
`admin` and `moderator` roles) must present a valid session cookie, read from
the raw `Cookie` header sent with the socket handshake (the browser attaches
it automatically since the `withCredentials: true` client option is set) —
there is no separate shared handshake password. Every connection immediately
receives a full state snapshot (`STATE_SYNC`) — reconnection is a first-class
feature, since phones sleep and venue Wi-Fi drops. If a session expires or is
revoked mid-event, only that one admin socket drops — live game state lives
server-side independent of any admin connection, so `display`/`players`
clients are unaffected; the admin just reconnects with a fresh token.

Events for one session are applied one at a time: each change to a live
session (an answer, a grade, a bonus, a roster change, a press, a quiz edit)
runs after the previous one for that session has finished, sees the session as
that one left it, and ends by reading fresh standings. Sessions don't wait for
each other. If that final standings read fails, the write still counts as done
(a press has already saved its progress, so memory must match the database and
clients must hear about it): the failure is logged, the session keeps its
earlier leaderboard, and the next write catches it up.

Each room gets **its own view**, built by the screen projection
(`projectScreen`, `apps/backend/src/game/state/screen-projection.util.ts`):
the display view names the screen on air; the admin view adds what `/control`
marks as on air plus server-decided Advance/Previous availability; the
players view adds answerability, names the **phone screen** (`phoneScreen`, which `/play` switches on instead of deriving its screen from the game state), and drops anything teams haven't been shown
yet (a kahoot question hidden behind the leaderboard is removed server-side,
never filtered by the client). In particular it carries only the reveal walk so
far: `revealQuestions` holds the questions before `revealIndex`, plus the one at
`revealIndex` once its `reveal` step is on air. A question the walk hasn't
reached stays in `blockQuestions` without its answer, so the phone shows a
correct answer exactly when one arrives and stepping back with Previous takes it
away again. At `ended` the players view keeps the final block's walk as it stood
when the quiz ended (trimmed by `previousStatus`, so a reconnecting phone keeps
its history): the whole block after advancing past the last reveal, the walk so
far if End Quiz was pressed mid-reveal, nothing if it was pressed before the
reveal started. Previous out of `ended` returns to the normal trim.

The players view also carries a **feedback field** (`feedback`): what the phone
is offered to rate right now, shared by every team's phone. It is
`{ kind, rounds: [{ id, title }] }`, or `null` when nothing is open for rating:

- `kind: 'break_card'` while the session is in a break status (`break_intro`,
  `break`, `break_round_intro`), listing the rounds of the block that just
  locked. Kahoot rounds never reach a break, so they never appear here.
- `kind: 'final_form'` at `ended`, listing **every** round of the quiz, kahoot
  rounds included, once no showdown is still being played (no showdown round, or
  the one created has been decided). A showdown being played keeps the field
  `null` and the phones on the showdown screens; a decided one lets the form
  appear under them.
- `null` in every other status. Previous out of `ended` therefore empties the
  field and the form disappears; the ratings stay, and reaching `ended` again
  lists the rounds filled in from the team's saved ratings.

The field is `null` throughout when the session's **`collectFeedback`** setting is off
(a boolean on the session settings, default `true`, validated by the partial-settings
Zod schema, editable in the lobby only like every other setting; a stored settings JSON
without the field reads as on, so sessions created before it have feedback on). The
`/control` lobby settings panel shows it as the "Collect feedback" switch.

The rule lives in one place (`getFeedbackField`, `game/state/feedback-rounds.util.ts`, on the
shared `describeFeedback`) and is used both to build the field and to accept a
rating, so the two can't disagree; the phone draws from it and never decides for
itself.

The display view's `onAirScreen` carries the same setting for the big screen: the
`break_intro` and `ended` screens have an `isFeedbackPromptShown` flag (true when
`collectFeedback` is on). `/display` draws "Rate the rounds on your phone ★" and
"Tell us what you thought — on your phone" from it and nothing otherwise. The `ended`
screen is not on air while a showdown is being played, so the line never shows then.

### The snapshot

`StateSnapshotPayload` is the single source of truth every client renders:

| Field             | Meaning                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `progress`        | Status + round/question indices + leaderboard flag                                                                                     |
| `currentQuestion` | What the big screen shows (only while `question_open`)                                                                                 |
| `blockQuestions`  | Questions open for answering (revealed-so-far during `question_open`; the whole locked block during `break`/`reveal`; empty otherwise) |
| `answeredTeamIds` | Teams that have answered the current question — drives all response indicators                                                         |
| `leaderboard`     | Graded totals, recomputed after every grade or bonus award                                                                             |
| `joinCode`        | Six-character code for this game session                                                                                               |
| `teams`           | Connected/registered teams                                                                                                             |

### Events

Server → client: `STATE_SYNC`, `STATE_UPDATED`, `JOIN_ACCEPTED`,
`ANSWER_RECEIVED`, `ANSWERS_UPDATED` (admin only — contains answer values),
`SESSION_CLOSED`.

Client → server: `ADMIN_ACTION`, `JOIN_PLAYERS`, `SUBMIT_ANSWER`, `RATE_ROUND`,
`SEND_FEEDBACK`, `GRADE_ANSWER`, `SELECT_QUIZ`, `KICK_TEAM`, `AWARD_BONUS` (all admin-only
except `JOIN_PLAYERS`/`SUBMIT_ANSWER`/`RATE_ROUND`/`SEND_FEEDBACK`, which are players-only). Room
membership is checked server-side on every handler; violations raise
`WsException`. Quiz listing/creation and session lifecycle (list, start,
close) now go over REST (`/quizzes`, `/sessions`) rather than sockets — see
[Sessions](#sessions-running-multiple-quizzes-at-once).

`RATE_ROUND` — `{ roundId, stars }`, `stars` an integer 1–5 (Zod-validated) —
saves a team's **round rating** for one round of the break card or the final form. The ack is the
result: `{ success: true }` once saved, or an error with a reason — "Feedback is off
for this session" when `collectFeedback` is off, "This round
can't be rated right now" when the round isn't in the feedback field's list (a
round outside the current block, a status that is neither a break nor `ended`, or a showdown still being played), or a
validation error for stars outside 1–5. The team is the one whose socket sent
it. One rating is kept per (session, round, team); rating again overwrites it
(last write wins). It is a plain team-scoped write: it broadcasts nothing and
doesn't go through the session write.

`SEND_FEEDBACK` — `{ comment, topics }` — saves the team's "Anything else?" comment
and **topic suggestions** from the final form. `comment` is a string of at most
1000 characters; `topics` is a list of at most 10 strings of at most 60 characters
each. Topics are trimmed and empty or whitespace-only ones dropped _before_ the limits
are checked, then saved; anything over a limit is refused by Zod validation. The
ack is the result: `{ success: true }` once saved, or an error with a reason —
"Feedback is off for this session" when `collectFeedback` is off,
"Feedback can't be sent right now" unless the session is `ended` with the final form
open (so before `ended`, in a break, and while a showdown is still being played are
all refused). One row is kept per (session, team) in `session_feedback` (`comment`
text, `topics` a JSON string array that is parsed with Zod on read, never cast), and
sending again replaces the whole row. Like `RATE_ROUND` it is a plain team-scoped
write: it broadcasts nothing and doesn't go through the session write. Stepping back
out of `ended` keeps the row.

Answer _content_ only ever goes to the admin room and the answering team
itself — the display and other players just see counts.

## Answer Lifecycle

1. **Submit** — a player sends `SUBMIT_ANSWER` for any question in
   `blockQuestions`. The server rejects submissions for questions outside the
   open block ("Answers are locked for this question") — locking is enforced
   server-side, not just hidden in the UI.
2. **Upsert** — answers are keyed `(gameSession, question, team)`;
   re-submitting overwrites (last-write-wins is the desired pub-quiz behavior).
3. **Acknowledge** — the submitter gets `ANSWER_RECEIVED`, which the phone
   uses to tick its checkmarks; the admin room gets the full `ANSWERS_UPDATED`
   list; everyone gets a fresh snapshot whose `answeredTeamIds` drives the
   admin's per-team ✓ marks and the display's "X of Y teams answered" counter.
4. **Grade** — the admin can grade an answer as soon as it arrives (0 / half
   / full points, where half is exactly half the question's points: 0.5 on a
   1-point question), and must finish any remaining grading in the `break`:
   leaving it is refused while an answer in the block is ungraded. If a team
   changes a hand-graded (`audio`/`youtube`) answer, its grade is cleared,
   since it belonged to the old value. Grades are written to the answer row;
   grading an answer twice is prevented in the UI. Exception: `closest_guess` answers are graded automatically once the
   block locks and reject a manual `GRADE_ANSWER` — see
   [Question Types](#question-types).
5. **Bonus points** — separately from per-question grading, the admin can
   award ad-hoc bonus points (`AWARD_BONUS`; categories like `shot`, `selfie`,
   `custom`) to a team at any time, also folded into the leaderboard.
6. **Leaderboard** — recomputed from graded points plus bonus awards after
   every change and broadcast to all rooms; shown whenever the admin toggles
   it.

A team's saved answers ride along on `JOIN_ACCEPTED`, so a phone that
reconnects (or reopens the tab) restores its checkmarks and can still revise
anything in the open block. So do its own round ratings (`roundRatings`, a list
of `{ roundId, stars }`, never another team's): the phone draws its stars from
this, so a rating whose save never reached the server shows as empty again. The
same goes for its comment and topics (`feedback`, `{ comment, topics }`, an empty
comment and no topics when it sent none), which the final form is filled in from;
a phone that reconnects marks them "Sent ✓".

## Teams: Join, Reconnect, and Kick

A `Team` is a **persistent entity independent of any single game session** —
it has a unique name, an opaque `token` (the reconnect credential held in
`localStorage`), and a human-enterable `code` (a recovery code letting a
second device join as the same team without the token). A team's membership
in one particular game session is tracked separately, in a pure roster join
table (`GameSessionTeam`).

- **New name** → creates a fresh `Team` row with a fresh token and code, and
  adds it to the session roster.
- **Existing name + saved token** → reconnects silently (adding the team to a
  _new_ session's roster still requires that session's join code).
- **Existing name, no token** (e.g. a teammate's phone) → requires the team's
  recovery `code`, since a bare name match isn't proof of identity.
- **Kick** — the admin can remove a team from the _current session's roster_
  (`KICK_TEAM`) without touching the underlying `Team` entity or its answer
  history; a kicked team's persistent identity and past scores survive.
  Available only for disconnected teams in the admin UI.

## Question Types

`QuestionType` is one of `free_text`, `multiple_choice`, `audio`, `youtube`,
`sort`, `match`, or `closest_guess`. Each has its own submission format and
grading behavior:

- **`free_text`** — any typed answer (`FreeTextAnswer`). An answer matching
  the stored `answer` (trimmed, case-insensitive, so "Paris"/" paris "/"PARIS"
  all match) is graded correct at submit time. Any other answer is left
  ungraded for the admin — a synonym or typo worth accepting, or a plain
  miss. The admin can override any answer, matching or not.
- **`multiple_choice`** — players pick one of `options`. Auto-graded at
  submit time by exact match against the stored `answer`.
- **`audio`** — `media_url` is required and plays on `/display` as an
  autoplaying `<audio controls>` element. Teams type an answer, or pick from
  `options` when the author adds at least two (the answer must then be one of
  them, as for `multiple_choice`). Same rule as `free_text`: an answer
  matching the key (a picked option is stored as its text) is graded correct
  at submit time, any other waits for the admin.
- **`youtube`** — `media_url` is required and must resolve to a
  `youtube.com`/`youtu.be` video id (enforced by both the CSV import schema
  and the manual editor's save validation). The display renders it as an
  embedded iframe instead of `<img>`/`<audio>`; under the hood this
  rendering is actually keyed off `media_url` itself, not the `type` value —
  matching how image vs. audio already works — so a `free_text`/etc. row
  with a YouTube `media_url` still embeds too. A clip's start/end (seconds
  into the video) is best-effort parsed out of that question's `notes` cell,
  e.g. `{start: "1:22", end: "2:20"}` (`M:SS`, `H:MM:SS`, or plain seconds
  all parse) — this isn't strict JSON, it's a regex looking for
  `start`/`end` keywords, so `notes` without that syntax is left untouched
  as a normal free-text note. Parsing happens once, in
  `QuizService.syncRoundsAndQuestions` (shared by CSV import and the manual
  editor's Save), which derives `mediaStartSeconds`/`mediaEndSeconds` into
  the question's JSON `payload` alongside `mediaUrl`. `answer_media_url`
  never gets clip times (no notes channel of its own) — a YouTube answer
  video always renders full-length. Optional `options` and hand grading,
  same as `audio`.
- **`sort`** — players drag `options` into what they think is the correct
  order (`SortAnswer`, `apps/frontend/app/play/sort-answer.tsx`); the
  submitted value is the reordered pipe-list. The CSV `answer` cell must
  contain the same items as `options`, just reordered — validated as a
  multiset match at import time. Auto-graded at submit time by exact match.
- **`match`** — players pair each left-hand item with a right-hand item
  (`MatchAnswer`, `apps/frontend/app/play/match-answer.tsx`); `QuestionView`
  carries the two lists separately as `options` (left) and `matchTargets`
  (right). In the CSV, both lists are packed into one `options` cell, joined
  by a single `+`: `left1|left2+right1|right2`. The `answer` cell lists
  correct pairs as `left+right`, pipe-separated, in any order (e.g.
  `arthur+excalibur|robin hood+bow`) — import canonicalizes it into `left`'s
  order so it's directly comparable to a submission, which is built the same
  positional way. Auto-graded at submit time by counting correct pairs
  position-by-position. How that count becomes points depends on the
  question's `matchScoringMode` (set in the manual editor only, like
  `kahootMode` — never from CSV; unset behaves as `partial`): `partial`
  splits the question's points evenly across pairs and rounds to the nearest
  half point (4 points, 3 pairs, 2 correct → 2.5; 1 point, 2 pairs, 1 correct
  → 0.5); `all_or_nothing` gives full points when every
  pair is correct, exactly half the question's points when exactly one is wrong, and zero
  otherwise.
- **`closest_guess`** — a numeric-guess question (CSV `answer` must parse as
  a number); players type a guess in a `type="number"` input. It is
  **auto-graded**, but not at submit time like
  `multiple_choice`/`sort`/`match` — `AnswerService` rejects a manual
  `GRADE_ANSWER` on one of these with an error. Once the block locks,
  `GameStateService` batch-grades every submission, awarding full points to
  whichever team(s) are numerically closest to the answer (ties share full
  points) and 0 to everyone else, caching the result per question
  (`closestGuessSummaries`) since it only needs computing once. During
  `reveal`, a `closest_guess` question with at least one submission gets a
  5-step cumulative walk instead of the usual single-shot reveal —
  `ADVANCE`/`PREVIOUS` step through smallest guess → highest guess → correct
  answer → closest team(s), each step adding a line without replacing what's
  already shown (`ClosestGuessRevealScreen`, shared by `/display` and
  `/play`). Phones receive each step's data only once it is on air: the
  players view carries the lowest guess from step 1, the highest from step 2,
  the answer (and answer media) from step 3 and the closest teams from step 4,
  and `PREVIOUS` takes the later fields away again. A question with zero
  submissions collapses back to the normal single-shot reveal, since there's
  nothing to walk through, and carries its answer straight away.

`multiple_choice`/`sort`/`match` are auto-graded the instant a team submits,
and the admin can still override any of them per answer;
`free_text`/`audio`/`youtube` (grading mode `match-or-human`) are graded
correct at submit when the answer matches the key and otherwise left ungraded
for the admin, who can override any of them too. A revision that matches is
graded correct (replacing any earlier grade); a revision that doesn't match
and differs from the previous value goes back to ungraded, even if the admin
had graded the previous value; resubmitting the same value leaves its grade
alone. `closest_guess` is auto-graded
but deferred to a single batch pass once the block locks, and is the one type
that can't be overridden. Which list each type is in (auto-graded,
overridable, kahoot-allowed) is defined once per type in the question type
registry (`QUESTION_KINDS`, `shared/types/src/question-kind.ts`). Any type can
carry `media_url`/`answer_media_url` — image vs. audio vs. YouTube is inferred
from the URL, so there is deliberately no dedicated `picture` type.

## Quiz Authoring and CSV Import

The `/quizzes/[id]` page is a full quiz editor, not just an import target:

- Start from scratch (one empty round), seed the whole quiz from a CSV
  upload, or paste a Google Sheets link — all three offered on the
  empty-state screen.
- Edit the quiz title; per round, edit its title, toggle `breakAfter`, reorder
  with up/down buttons (no drag-and-drop), delete, or add questions; per
  question, edit type/prompt/options/answer/points/media.
- Re-import a CSV or re-fetch a Google Sheets link mid-edit at any time — it
  overwrites the current draft.
- Save via `POST /quizzes` or `PUT /quizzes/:id`, both Zod-validated
  server-side, surfacing structured issues per round/question on failure.
- Export the quiz's questions with **Export CSV** in the header bar.

**Editing a live quiz**: a quiz can be edited at any time, including while a
session on it is running (any status other than `lobby`/`ended`). Two rules
apply while live, enforced by `findLiveEditViolations`
(`apps/backend/src/quiz/live-edit-guard.ts`) as a `409` and mirrored in the
editor's disabled controls:

- **No structural changes** — rounds/questions can't be added, removed, or
  reordered. Game progress is positional (`roundIndex`/`questionIndex`), so a
  shift would move the game onto a different question, and deleting a
  question cascades to its teams' answers.
- **Opened questions keep their type and choices** (`type`, `options`,
  `matchTargets`) — that's what teams answered against, and auto-grading is
  exact-match, so e.g. fixing an option's spelling would zero every team that
  picked it. Their prompt, answer, points, notes, and media stay editable.

A question counts as opened from the moment it first opens in a session and
stays opened for the rest of it, even if Previous steps back before it. Each
session stores its opened question ids (`game_sessions.opened_question_ids`),
added to whenever a press settles, so they survive a backend restart. A
session saved before this existed has none stored and derives them from its
position on restore.

After the save, every live session reloads its in-memory quiz and rebroadcasts.
If an opened question's `answer` or `points` changed, its existing answers are
re-graded (`BlockGradingService.regradeQuestions`): auto-graded types
(`multiple_choice`/`sort`/`match`) re-score every answer — overwriting any
manual override, e.g. adjusted `match` partial credit — and re-apply kahoot
speed scaling (kept to the nearest half point, so a half-credit match never
rounds back up to full points) from the response time stored on each answer at submit (so it
survives a backend restart, and a correction made before the question locks is
speed-scaled like any other); an already-graded `closest_guess` re-runs its batch;
`match-or-human` types (`free_text`/`audio`/`youtube`) grade answers that
match the corrected key correct, keep the admin's grade on a non-matching
answer, and send any other non-matching answer back to ungraded — including
one that was auto-graded correct under the old key (told apart by re-running
the submit-time grade against the key as it stood before the edit). The editor keeps sort/match
display order stable across saves (`savedDisplayOrder`), so a re-save doesn't
reshuffle what players see.

**CSV export mechanics**: purely client-side — `quizToCsv`
(`apps/frontend/app/lib/quiz-csv-export.ts`) serializes the editor's current
draft (unsaved edits included) into the same 12-column format the importer
reads, so an exported file re-imports as-is. `break_after`, `category`, and
`author` all land on each round's last row; `match` answers are rebuilt as
`left+right` pairs. Rounds with no questions are omitted, and `kahootMode`
has no column, so it isn't exported.

**CSV import mechanics**: the browser reads the uploaded file's text directly
(`file.text()`) and POSTs it to `POST /import/preview`. The parsed
rounds/questions load straight into the in-page editable draft; saving goes
through the normal quiz endpoints above. The backend also exposes
`POST /import/confirm` (upserts a quiz directly, keyed by title, only while a
session is `lobby`/`ended`; when it overwrites that session's active quiz,
the session reloads and rebroadcasts through the same `notifyQuizEdited` path
as an editor save), but the current frontend doesn't call it — the shipped
flow is preview → edit → save.

**Google Sheets URL import mechanics**: `POST /import/preview-from-url` and
`POST /import/confirm-from-url` accept a pasted `sheetUrl` instead of
`csvText`. An earlier version of this rejected doing this server-side
entirely, over the SSRF risk of fetching a user-supplied URL from the
backend. The mitigation actually shipped: `sheet-url-fetcher.ts` never
fetches the pasted string — it validates the URL is `https://docs.google.com`
with a `/spreadsheets/d/{id}` path, extracts only the id (+ optional `gid`),
and builds the fetch URL itself (`.../export?format=csv`), so the fetch
target's host is always fixed at `docs.google.com` regardless of input.
Google's export endpoint always 307-redirects to a per-request URL on its own
CDN (`*.googleusercontent.com`) — even for a fully public sheet, before any
sharing check runs — so the fetch uses `redirect: 'manual'` and follows
**at most one hop**, only when the redirect target's host is
`docs.google.com` or ends with `.googleusercontent.com`; anything else (a
Google sign-in page for a non-public sheet, or a second redirect from the
CDN itself) is treated as a fetch failure instead of being followed. That
keeps the redirect target either fixed or restricted to Google's own
infrastructure, never attacker-influenced. The fetch also has a request
timeout and a response size cap. The route is gated by the same
`SessionGuard`/`RolesGuard` as the rest of `/import/*` (admin/moderator
only). This only works for sheets shared as "Anyone with the link can view"
(or public) — a private sheet's export endpoint redirects to a Google
sign-in page, which surfaces as a fetch failure with a message telling the
admin to check sharing settings.

**Image uploads**: next to each media URL field in the editor, an upload
button sends the chosen image to `POST /media` (multipart field `file`,
admin/moderator only, 5 MB cap) and fills the field with the returned public
URL — everything downstream still just sees a plain `mediaUrl`. The backend
ignores the uploader's filename and claimed MIME type: `detectImageType`
sniffs the real format from the file's magic bytes (JPEG, PNG, GIF, WebP,
AVIF — SVG is refused, it can carry scripts) and `MediaService` stores it
under `quiz-media/<uuid>.<ext>`, so an answer image's URL can't be guessed
before reveal. Storage sits behind the `MediaStorage` interface
(`apps/backend/src/media/media-storage.ts`); `MEDIA_STORAGE_PROVIDER` picks
the driver in `create-media-storage.ts`. Only `vercel-blob` ships — create a
**public** Blob store and set `BLOB_READ_WRITE_TOKEN`. With no token the app
still boots and uploads answer 503.

To swap in Cloudflare R2 (or any S3-compatible store): add
`r2-media-storage.ts` implementing `MediaStorage.put()` (store `data` at
`key` with `contentType`, return the public URL — R2 speaks S3, so
`@aws-sdk/client-s3` works), add an `'r2'` case in `createMediaStorage`,
and set `MEDIA_STORAGE_PROVIDER=r2` plus that driver's credentials. Nothing
else changes; URLs already stored in quizzes keep working because they are
plain links.

Sheet row format (one row per question):

```
round | type | question | options | answer | points | media_url | answer_media_url | notes | break_after | category | author
```

`type` is one of the seven [Question Types](#question-types) above — see
that section for what each needs in `options` and `answer`. `media_url` is
required for `audio`/`youtube`, optional otherwise. `answer_media_url` is
optional on any type (shown alongside the correct answer during reveal).
`break_after` is `''`/`0`/`1`; the **last round's break is always forced on**
regardless of its cells, since the state machine has no other way to ever
reveal it. `category` and `author` are optional, round-level metadata (a
topic/theme and who wrote the round) shown on the big screen's round intro
and round overview — like `break_after`, they're resolved per round rather
than per row: the first non-blank cell seen for a round wins, conventionally
put on its last row. `category` is matched against a fixed list —
General knowledge, History, Geography, Science & nature, Sports, Music,
Film & TV, Literature & books, Art & culture, News, Food & drink, Other
(`ROUND_CATEGORIES` in `shared/types/src/round-category.ts`) —
case-insensitively and normalized to the canonical spelling; a cell that
doesn't match anything in the list is silently left blank rather than
blocking the import (an unrecognized category is a typo, not something
worth stopping an admin's import over). The manual quiz editor offers the
same list as a `<select>`, so it can never produce an invalid value.
`author` stays free text.

## Persistence and Restart Resilience

Postgres via MikroORM. Two halves of the schema:

- **Authoring time**: `quizzes → rounds → questions`. Questions have a `type`
  (any [question type](#question-types)) plus a JSON
  payload for type-specific data (options, media URL), so new question types
  don't need migrations.
- **Runtime**: `game_sessions → teams → answers`, plus `bonus_awards` and the
  `game_session_teams` roster join table. A session row stores the join code
  and the live progress columns (`status`, `currentRoundIndex`,
  `currentQuestionIndex`, `isLeaderboardVisible`), updated on **every**
  transition.

Entities live in `apps/backend/src/db/entities/`, one repository per entity in
`apps/backend/src/db/repositories/`, injected via `@InjectRepository`.
Migrations live in `apps/backend/src/db/migrations/` and run via
`pnpm db:migrate` / `pnpm db:migrate:prod`.

On boot the backend seeds the hardcoded demo quiz idempotently, loads
persisted sessions, and rehydrates each one's progress — a redeploy mid-quiz
means roughly ten seconds of frozen sockets, then every client resyncs from
its automatic reconnect. Answers, teams, and grades survive because they were
never only in memory.

`GameProgressRepository.load()` normalizes any row still carrying the
retired `locked` status back to `question_open`, so quiz nights that started
on an older schema version keep working without a data migration.

## Authentication

- **Admin/moderator**: per-user accounts with two roles — `admin` (everything,
  including user management) and `moderator` (everything except user
  management). New accounts self-register as `pending`; an existing admin
  approves them and assigns a role. Passwords are bcrypt-hashed; login issues
  an opaque, DB-backed session token with sliding expiration (every validated
  request/handshake pushes it forward), delivered as an httpOnly session
  cookie (`campus_pubquiz_session`, set by `POST /auth/login`). REST calls
  send it automatically (`credentials: 'include'`); the Socket.IO handshake
  reads it from the raw `Cookie` header (`extractSessionCookie`), since
  `cookie-parser`'s Express middleware doesn't run on the WS upgrade.
  Deactivating a user revokes all of its sessions immediately. The first
  admin account is bootstrapped at startup from
  `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars, since
  self-registration alone can't produce the first approver.
- **Teams**: join with a team name + the session's join code (typed or via the
  QR code on the display), or reconnect via a saved token/recovery code — see
  [Teams](#teams-join-reconnect-and-kick). Names are unique per team, not per
  session.

## Sessions: Running Multiple Quizzes at Once

The backend can run several `GameSession`s concurrently, each bound to one
`Quiz` and identified by its own join code. `/sessions` is the authenticated
admin/moderator landing page for managing them:

- `GET /sessions` — list running sessions (auth-gated).
- `POST /sessions` (`{ quizId }`) — start a new session, producing a fresh
  join code.
- `DELETE /sessions/:joinCode` — close a session; blocked mid-game (409) via
  a dedicated guard.
- `GET /sessions/public` — **unauthenticated**, so `/display` (venue TV, no
  login) can list/pick a running session without credentials. Exposes only
  join code, title, status, and team count.

Picking or starting a session in `/sessions` routes the admin to
`/control?code=<joinCode>`, which binds that admin tab to one specific session
for the rest of the flow.

## Session Stats

`/stats` lists every **ended** session; `/stats/:id` (`GET /stats/sessions/:id`,
`getSessionDetail`) is the deep dive for one: standings, a rounds table,
a questions table and highlight tiles. All of it is computed per request from
the stored rows, never cached.

The rounds table carries each round's **rating**: `rating: { average, count } | null`
on the session detail's round rows, shown as "★ 4.2 · 9 teams", or "—" when no
team rated the round. It is aggregated in SQL from the round ratings of that one
session (`avg(stars)`, `count(*)` per round), so the response never carries a
team id or name for any rating — ratings are anonymous on this page and in the API.

The session detail also carries a `feedback` section, shown on the page as
**Comments** and **Topic suggestions**:
`{ collected, comments: [{ text, submittedAt }], topics: [{ topic, count }] }`.

- `collected` is the session's `collectFeedback` setting (a session stored without
  it reads as `true`). When it is `false` the lists are empty and the page shows
  "Feedback was off for this session" instead of the two sections.
- `comments` are the teams' "Anything else" texts, newest first, with empty and
  whitespace-only ones skipped.
- `topics` group suggestions that match after trimming, collapsing inner
  whitespace and ignoring case. A group shows its most common spelling (on a tie,
  the first submitted) and the list is sorted by count, then alphabetically
  ("Geography ×4").
- The team is never selected: no team id or name reaches the response or the page.
  Comment and topic order uses when the team last sent its feedback.

## Deploy and CI

- **Backend** deploys to Render (`render.yaml`) on the Docker runtime
  (`apps/backend/Dockerfile`), as a single instance — no horizontal scaling,
  no Redis adapter (see `CLAUDE.md` → Known Tradeoffs). It must never go on
  Vercel: serverless and Socket.IO are incompatible.
- **Frontend** deploys separately; its origin is what `FRONTEND_ORIGIN`
  allows through CORS (see `cors.config.spec.ts`).
- **CI** (`.github/workflows/ci.yml`) runs `pnpm build && pnpm lint && pnpm test`
  on every push to `main` and every PR. Build must come first:
  `@campus-pubquiz/types` resolves via its `dist/`, so frontend/backend type
  checking needs it built; `pnpm -r` runs workspaces in topological order, so
  `pnpm build` alone handles that.
- The backend's Postgres specs share one real `postgres:16-alpine` container
  per test run (`@testcontainers/postgresql`). Jest's global set-up
  (`apps/backend/src/test-db/`) starts it and runs the real migrations on a
  template database once; each Jest worker clones its own database from that
  template, and a spec gets it by calling `useTestDatabase()` inside a
  top-level `describe` (every entity table is emptied after each test). The
  global teardown stops the container. That works on GitHub's `ubuntu-latest`
  runners without a `services:` block, since Docker is preinstalled; with
  Docker stopped the run fails once with "Docker is required". No spec starts
  its own container. A spec that must begin with no tables (the migration
  backfill spec) calls `useUnmigratedTestDatabase()` instead, which makes an
  empty database on the same container and drops it afterwards.
