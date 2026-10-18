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

Diagrams of the module structure, the main event flows, the status machine and
the data model live in [`docs/architecture.md`](docs/architecture.md).

## The Three UIs

| Route      | Who             | What it does                                                                                                                                                                           |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/display` | Big screen (TV) | If no session is picked, shows a session picker; otherwise the current status screen (lobby, rules, round intro, question, locking countdown, break intro, reveal, leaderboard, ended) |

The big screen survives a dropped connection. While socket.io retries it keeps
the last frame and shows a small "Reconnecting…" badge in the corner, then
resyncs on its own; it goes back to the picker only when the server refuses the
code (`io server disconnect`, e.g. "Unknown game session code"). `useGameConnection`
reports this as `connectionIssue`: `reconnecting` or `refused`. The screen
remembers the last code it showed in localStorage (every access wrapped in
try/catch), so a reload or a bare `/display` resumes that session, falling back
to the picker if the code is refused; the lobby has a small "Pick another game"
link to leave it. With storage unavailable the screen still works and just
starts at the picker.
| `/control` | Quiz master's laptop | Bound to one session via `?code=`; state machine controls, grading, teams roster (with kick), bonus awards |
| `/play` | Team phones | Join by name + code (or reconnect via saved token/team code), browse open questions, submit and revise answers, review a running history of every question seen so far |

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
| `/teams/[id]`    | Admin/moderator (any)       | One team's history over its ended sessions, linked from `/teams`                |

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
status groups) live in [`GLOSSARY.md`](GLOSSARY.md); this table is the
behaviour of each status.

| Status              | Big screen                                                                                                                                                                                                                                                                                                                    | Phones                                                                                                                                                                                                                                                               | Reached by                                                                                                                         | `ADVANCE` goes to                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `lobby`             | QR code and join code; joined teams pop into the roster with a chime (at most one per 500 ms; teams present at load stay silent)                                                                                                                                                                                              | "You're in! Look for (the team's name) on the big screen", "Waiting for the quiz to start…" + the player count card + rules link                                                                                                                                     | Session created, or `PREVIOUS` from `rules`                                                                                        | — (`START_QUIZ` → `rules`)                                                                                             |
| `rules`             | Rules: round/topic/break structure + house rules, shown once per quiz                                                                                                                                                                                                                                                         | The same rules                                                                                                                                                                                                                                                       | `START_QUIZ`                                                                                                                       | `round_overview`, or `round_intro` if the overview is turned off                                                       |
| `round_overview`    | Every round's title (with category/author), shown once                                                                                                                                                                                                                                                                        | "Look at the screen — Rounds"                                                                                                                                                                                                                                        | `ADVANCE` from `rules`                                                                                                             | First round's `round_intro`                                                                                            |
| `round_intro`       | Round title card: "ROUND N — category", title, author                                                                                                                                                                                                                                                                         | "Look at the screen" + round title; the block browser instead if questions are already open                                                                                                                                                                          | `ADVANCE` from `round_overview`, from a round's last question when the block continues, or from the previous block's last `reveal` | That round's first `question_open`                                                                                     |
| `question_open`     | The current question (prompt + media)                                                                                                                                                                                                                                                                                         | Block browser: every question opened so far in the block, answerable (last write wins)                                                                                                                                                                               | `ADVANCE` from `round_intro` or the previous question                                                                              | Next question; the next round's `round_intro` if the block continues; `locking` on the block's last question           |
| `locking`           | Countdown on the block's last question                                                                                                                                                                                                                                                                                        | Still answerable, with a thin bar draining to the same lock deadline as the countdown; when the block locks the phone buzzes and stamps "Locked" (live moves only, not on reconnect or Previous)                                                                     | `ADVANCE` from the block's last question                                                                                           | `break_intro` — the block locks; a kahoot round goes straight to `reveal`                                              |
| `break_intro`       | "BREAK N" card, break timer, bonus categories, and "Rate the rounds on your phone ★" when feedback is collected                                                                                                                                                                                                               | Block browser, read-only                                                                                                                                                                                                                                             | The block locking                                                                                                                  | `reveal_intro` — refused while any answer in the block is ungraded                                                     |
| `break`             | One locked question under break review (prompt + media, no answer)                                                                                                                                                                                                                                                            | Block browser, read-only                                                                                                                                                                                                                                             | `PREVIOUS` from `break_intro` (lands on the block's last question) or from a later question                                        | The next question in the block; from the block's last question, `reveal_intro` (same ungraded check)                   |
| `break_round_intro` | Round title card: "ROUND N", title — no answers implied                                                                                                                                                                                                                                                                       | "Look at the screen" + round title                                                                                                                                                                                                                                   | `PREVIOUS` across the start of a round during break review                                                                         | Back into `break` on the same question                                                                                 |
| `reveal_intro`      | Round title card: "REVEALING ANSWERS · ROUND N", title                                                                                                                                                                                                                                                                        | "Look at the screen" + round title                                                                                                                                                                                                                                   | Leaving the break, or `ADVANCE` across the start of a round during the reveal                                                      | `reveal` on that round's first question                                                                                |
| `reveal`            | One question with its correct answer (and `answer_media_url`)                                                                                                                                                                                                                                                                 | Block browser with the team's answer, the correct answer and points                                                                                                                                                                                                  | `ADVANCE` from `reveal_intro` or the previous reveal question; `locking` in a kahoot round                                         | Next reveal question; `reveal_intro` at a round boundary; the next block's `round_intro`; `ended` after the last round |
| `ended`             | Final screen (a podium of the top three in three colours at the top, "Quiz complete!", the other teams with their places in a scrolling row like the lobby roster, and a thank-you — with an invitation to rate the rounds when feedback is collected), or an active showdown; confetti and a fanfare when the quiz ends live | "Quiz complete!", the team's final placing ("You finished 4th of 12", "Joint 2nd" for a tie; confetti for ranks 1–3), then the final feedback form (every round with its stars) once any showdown is decided; or the showdown guess form / reveal while it is played | `ADVANCE` past the last reveal, or `END_QUIZ`                                                                                      | —                                                                                                                      |

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

The leaderboard and the join overlay are deliberately _not_ statuses:
`isLeaderboardVisible` is a flag the admin can toggle from any status, and
`isJoinOverlayVisible` is a flag the admin can toggle from every status except
`lobby` and `ended`. Hiding either resumes exactly where the game was — the
quiz carries on underneath, timers included, and phones are untouched by the
join overlay. The join overlay shows the QR code, join code and team-size line
(no roster) on the big screen so a late team can join; it is saved with the
session, so it survives a restart, and any transition that lands on `lobby` or
`ended` (including `END_QUIZ`) clears it. The two are never up together:
showing either hides the other (showing the join overlay also resets the
leaderboard's rank reveal). While the join overlay is up, `ADVANCE` or
`PREVIOUS` only hides it (always pressable, even where Previous would otherwise
be refused); the press after that moves the quiz.

### Admin actions

| Action                    | Legal from                              | Effect                                                                                                                                                    |
| ------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `START_QUIZ`              | `lobby`                                 | → `rules`                                                                                                                                                 |
| `ADVANCE`                 | every status except `lobby` and `ended` | Steps forward per the table above, crossing block boundaries automatically                                                                                |
| `PREVIOUS`                | most non-terminal statuses              | Symmetric backward walk, including back across a block boundary into the prior block's `reveal`; from `rules`, back to `lobby`                            |
| `END_QUIZ`                | any except `ended`                      | Force-end                                                                                                                                                 |
| `TOGGLE_LEADERBOARD`      | any                                     | Flips `isLeaderboardVisible`, status untouched                                                                                                            |
| `TOGGLE_JOIN_OVERLAY`     | every status except `lobby` and `ended` | Flips `isJoinOverlayVisible`, status untouched; refused as an illegal transition elsewhere                                                                |
| `TOGGLE_MEDIA_FULLSCREEN` | any                                     | Flips `isMediaFullscreen`; any other action clears it                                                                                                     |
| `REPLAY_MEDIA`            | any                                     | Bumps `mediaReplayToken` (the display remounts the YouTube iframe; a video file seeks to its clip start and plays, no remount) and clears `isMediaPaused` |
| `TOGGLE_MEDIA_PAUSE`      | any                                     | Flips `isMediaPaused`; status untouched                                                                                                                   |

**Pausing media.** `isMediaPaused` is server-owned game state in `progress`
(so a display that reconnects mid-pause comes back paused). The big screen
applies it in place, without remounting anything: a YouTube embed (loaded with
`enablejsapi=1`) gets an IFrame API `pauseVideo`/`playVideo` `postMessage`
command, and a question `<audio>` or video-file `<video>` element is
`pause()`d/`play()`ed. Every
action that moves the quiz (`ADVANCE`, `PREVIOUS`, `END_QUIZ`, …) and
`REPLAY_MEDIA` resets it; the leaderboard and join overlay toggles leave it
alone. `/control` and `/remote` show Pause/Resume only for an open question
whose media is a video (YouTube or file) or audio. Browsers may refuse the
display's `play()` on resume if it has had no user interaction (autoplay
policy); a rejection is ignored and the moderator can press Resume again. A
standing pause is re-applied to a video file once it has loaded. "Play again"
(`REPLAY_MEDIA`) is offered for an open question with a video (YouTube or file),
not for audio.

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

Every event is declared once, in the protocol map in `shared/types`
(`socket-protocol.ts`), and both the backend gateway and the frontend clients
type their emits and listeners against that map.

Events for one session are applied one at a time: each change to a live
session (an answer, a grade, a bonus, a roster change, a press, a quiz edit)
runs after the previous one for that session has finished, sees the session as
that one left it, and ends by reading fresh standings. An event is checked
against that session and stores nothing when it is refused: a team's last-second
answer is either stored (and seen by the press that follows, so a closest_guess
answer is graded by the break) or refused with "Answers are locked for this
question", never stored unseen. Sessions don't wait for
each other. If that final standings read fails, the write still counts as done
(a press has already saved its progress, so memory must match the database and
clients must hear about it): the failure is logged, the session keeps its
earlier leaderboard, and the next write catches it up. A write that moves an
auto-lock deadline (the question lock or the kahoot question timer) reports the
new deadlines with its outcome, and the delivery step re-arms that session's
timers from them before anything is emitted, so the timers follow the
session's deadlines after every change. A refused event reports nothing and
leaves the timers as they were.

Each room gets **its own view**, built by the screen projection
(`projectScreen`, `shared/types/src/screen-projection.ts`, a pure module the backend calls):
the display view names the screen on air; the admin view adds what `/control`
marks as on air plus server-decided Advance/Previous availability, and gives each
roster team its player count and over-cap flag; the
players view adds answerability, names the **phone screen** (`phoneScreen`, which `/play` switches on instead of deriving its screen from the game state), and drops anything teams haven't been shown
yet (a kahoot question hidden behind the leaderboard is removed server-side,
never filtered by the client). In particular it carries only the reveal walk so
far: `revealQuestions` holds the questions before `revealIndex`, plus the one at
`revealIndex` once its `reveal` step is on air. A question the walk hasn't
reached stays in `blockQuestions` without its answer, so the phone shows a
correct answer exactly when one arrives and stepping back with Previous takes it
away again.

Every reveal question carries a **reveal kind** (`revealKind`), decided once by the
projection from the question type registry, and the screens switch on it instead
of re-deriving it from the type. The admin views receive `answer`
(the question with its answer and optional answer media, no closest-guess stats)
or `closest_guess` (the same plus the `closestGuess` stats; the "no submissions"
stats when nobody guessed), always untrimmed. `/display` and the players view
are sent the on-air closest_guess question trimmed to its step by the
Closest-guess reveal module (the same function for both rooms), and can also
receive `closest_guess_pending`: before the answer step (3) it is the block
question view plus the stats lines reached so far, with no answer and no answer
media; from step 3 on it is `closest_guess` with the stats reached so far. The
closest teams (`closestGuesses`) are present only once they are on air. Only the
question at the reveal position is trimmed; earlier reveal questions are sent
whole. A closest_guess question nobody guessed on is sent whole as
`closest_guess`, and so is the `ended` reveal walk. The seeded question has no
reveal kind or stats; they are added when the block's questions are dressed as
reveal views. Both closest-guess kinds draw `ClosestGuessRevealScreen`, which takes
no step: it draws the prompt and whichever stats lines it is sent, so a phone
browsing back to an earlier closest_guess question shows it fully revealed. Only
`closest_guess` passes the correct answer and answer media; the screens' switches
are exhaustive, so a new kind fails typecheck until each handles it. At `ended` the players view keeps the final block's walk as it stood
when the quiz ended (trimmed by `previousStatus`, so a reconnecting phone keeps
its history): the whole block after advancing past the last reveal, the walk so
far if End Quiz was pressed mid-reveal, nothing if it was pressed before the
reveal started. Previous out of `ended` returns to the normal trim.

The frontend never projects a view: pages render the view they are sent, with no fallback for a field the view always carries. Frontend tests get their views from the same projection through the fixture builder (`roomView`, `apps/frontend/test-utils/room-view.ts`), so a test fixture cannot disagree with what the server sends.

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

The rule lives in one place (`getFeedbackField`, `shared/types/src/feedback-rounds.ts`, on the
shared `describeFeedback`) and is used both to build the field and to accept a
rating, so the two can't disagree; the phone draws from it and never decides for
itself.

The display view's `onAirScreen` carries the same setting for the big screen: the
`break_intro` and `ended` screens have an `isFeedbackPromptShown` flag (true when
`collectFeedback` is on). `/display` draws "Rate the rounds on your phone ★" and
the invitation to rate the rounds in the final thank-you from it, and nothing otherwise.
The `ended` screen is not on air while a showdown is being played, so the thank-you
never shows then.

The final placing is drawn from the snapshot's `leaderboard` (the server's
competition ranks): `/display` shows the top three on a podium, and each phone
shows its own team's "You finished 4th of 12" ("Joint 2nd" when `rank` differs
from `rankTo`) between "Quiz complete!" and the feedback form. Because the phone
screen is `ended` only once any showdown is decided, the card waits for the
showdown. Confetti (the big screen always, a phone only for ranks 1–3) and the
fanfare fire through the live-change helper, so never on a reloaded display, a
reconnected phone or Previous.

### The snapshot

`StateSnapshotPayload` is the shared base every room's state view is built
from; each room is sent the base plus the fields only it reads (the Screen
projection adds them, the core snapshot never builds them for the others).
`STATE_SYNC` (resync on connect) and `STATE_UPDATED` (live) carry the same
view for a room.

**Shared base** (every room):

| Field             | Meaning                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `progress`        | Status + round/question indices + leaderboard flag                                                                                     |
| `currentQuestion` | What the big screen shows (only while `question_open`)                                                                                 |
| `blockQuestions`  | Questions open for answering (revealed-so-far during `question_open`; the whole locked block during `break`/`reveal`; empty otherwise) |
| `answeredTeamIds` | Teams that have answered the current question — drives all response indicators                                                         |
| `leaderboard`     | Graded totals, recomputed after every grade or bonus award                                                                             |
| `joinCode`        | Six-character code for this game session                                                                                               |
| `teams`           | Connected/registered teams                                                                                                             |

The base also holds the other fields two or more rooms read (round titles,
quiz structure, `questionLockAt`, `breakEndsAt`, `displayTextScale`,
`isDisplaySoundMuted` (the big-screen mute; ephemeral like `displayTextScale`,
and `/display` hands it to its sound registry), settings, showdown state, the closest_guess reveal step, `revealQuestions`).

Browsers block audio until a tap, so `/display` shows an "Enable sound" button
until it is tapped, whenever any display sound can play (that is, unless the
big-screen mute is on), whatever the lock-countdown setting says. The mute also
silences the lock-countdown track.

**Fields that belong to one room's view:**

| View                            | Fields                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display (`DisplayStatePayload`) | `roundCategory`, `roundAuthor`, `roundCategories`, `roundAuthors`, `leaderboardRevealCount`, `leaderboardBoard`, `kahootQuestionEndsAt`, `teamsCorrect`, `funFacts` |
| Admin (`AdminStatePayload`)     | `ungradedQuestionIds`, `phaseStartedAt`, `phaseElapsedMs` (read by `/control` and `/remote`)                                                                        |
| Players (`PlayersStatePayload`) | `upcomingQuestions`, `pastRevealedQuestions`, `phoneLeaderboard`                                                                                                    |

A field only one room reads is added to that room's view type, not the base.

**The display's leaderboard (`leaderboardBoard`).** The server describes the
board once and `/display` draws it as sent (the Screen projection builds it
from the session, so a reloaded or second big screen draws the same thing):

- `entries` — the standings, already capped: a kahoot round keeps the first
  five by final standing, splitting a tie at the cutoff (the reveal walk's step
  count is taken over the same capped entries).
- `countUpBoard` — present only for the between-questions kahoot board: the
  prior standings of the teams in `entries`, which the board holds, counts up
  from, then reorders into `entries`. Absent everywhere else, and on the first
  board after a backend restart (the prior standings are ephemeral).
- `trends` — `up` / `down` / `same` per team id, shown once the board settles.
  The basis is the prior standings in a kahoot round (between questions, round
  end, quiz end), otherwise the standings with the current round's points
  backed out. When the prior standings are a real board with more than one team
  all tied (e.g. everyone on 0), every team is `up`. A team missing from the
  basis has no trend. Ranks are compared with the shared ranking rule.

`leaderboardRevealCount` stays a separate display field: how many ranks,
counting up from last place, are revealed.

On the big screen the ranks reveal one per Advance as always; ranks 1 to 3
come in slower (a drumroll sound on the display, if sound is enabled).
Pressing Advance during an entrance cuts it to its end.
On the last leaderboard (shown once the quiz has ended, or during its last break)
ranks 1 to 3 stand on a coloured podium instead of in rows, one step per Advance;
once the winner's step has landed the display plays the fanfare and shoots
confetti. A reloaded display or a reconnect stays silent, as everywhere else.

**The phone's leaderboard (`phoneLeaderboard`).** The players view carries the
same `leaderboardBoard` description plus the reveal count (`{ board,
revealCount }`). The phone's leaderboard screen shows only the team's own row,
and only once the big screen has revealed that rank, so the phone never gives
away what the big screen is still building up to: "You're 4th", or "Joint 2nd"
for a tie group (from the competition rank). The phone vibrates once when that
row is revealed live and the team's trend is `up`; never on a first snapshot,
reconnect or Previous (the live-change rule), and never for a team with no
trend. A team outside a capped kahoot board has no row.

**The reveal's teams-correct count (`teamsCorrect`).** While a question's
`reveal` step is on air, the display view carries `{ correct, partial,
teamCount }` for that question, and `/display` draws it as a count-up "7 of 12
teams" with "+2 close" when `partial` is above 0. `correct` and `partial` count
the roster teams whose answer has that verdict (see Verdict in the glossary);
`teamCount` is every roster team, so teams that did not answer are in the
total. It is `null` outside a reveal and on a closest_guess question, whose
reveal already names the closest teams. The session holds the per-question
tallies and re-reads them with the standings at the end of every session write
and when a session is placed (creation, restart), so they follow hand grades,
lock grading and key fixes.

**The break's fun facts (`funFacts`).** While the break screen is on air
(`onAirScreen.kind === 'break_intro'`; not over the leaderboard, not while
stepping through the block in break review) the display view carries
`funFacts: FunFact[]`; on every other screen it is `[]`, and the players and
admin views have no such field. Each fact is a typed object, not a sentence:
`/display` words it. The server builds the list in the shared `describeFunFacts`
module, in this order, and skips a fact with no data:

| `kind`                   | Fields                               | Meaning                                                                                                                                                         |
| ------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fastest_correct_answer` | `teamName`, `responseMs`, `question` | Quickest `correct` answer to a kahoot question (response time is a race only there); ties go to the alphabetically first team                                   |
| `toughest_question`      | `correctRate` (0-1), `question`      | Lowest correct rate above 0 of the revealed questions, never the question `nobody_got_it` names; skipped when none is below 1; never a `closest_guess` question |
| `room_split`             | `correctRate` (0-1), `question`      | Revealed question whose correct rate is closest to one half (strictly between 0 and 1); never a `closest_guess` question                                        |
| `nobody_got_it`          | `question`                           | First revealed question with no `correct` answer (a question nobody answered is skipped); never a `closest_guess` question                                      |
| `clean_sweep`            | `teamNames`                          | Teams that got every question of the last revealed block `correct`, alphabetical; `closest_guess` questions of the block are not counted                        |
| `bonus_awards_so_far`    | `counts: { category, count }[]`      | Positive bonus awards per category, in category order (`shot`, `selfie`, `custom`)                                                                              |

`question` is `{ questionId, roundNumber, questionNumberInRound, prompt }`. The
correct rate is the stats page's definition: `correct` counts fully, `partial`
as its points' share of the question's points, over every roster team. A
`closest_guess` question has a single winner by design (ties aside), so its
correct rate says nothing and it always has a winner: it is left out of
`toughest_question`, `room_split` and `nobody_got_it`, and out of the
`clean_sweep` block (a block of only closest guesses has no sweep).
`fastest_correct_answer` stays kahoot-only. The
facts about questions read only the blocks before the block in play (whose
answers stay hidden until its reveal); the block in play contributes nothing.
At the first break nothing is revealed, so only `bonus_awards_so_far` can
appear (and the list is `[]` when no bonus was awarded). The session holds the
answers and bonus awards (`funFactData`) and re-reads them with the standings
at the end of every session write and when a session is placed, so the facts
follow hand grades and key fixes.

The **`funFactsEnabled`** session setting (a boolean, default `true`, validated
by the partial-settings Zod schema, editable in the lobby only like every other
setting; a stored settings JSON without the field reads as on) turns all fun
facts off: the server then sends `funFacts: []` on the break screen too. The
`/control` lobby settings panel shows it as the "Fun facts on the break screen"
switch. There is no per-fact choice.

`/display` (`BreakIntroScreen`, via `FunFactRotator`) first shows the break card
as it was before fun facts; the first fact appears `FUN_FACT_START_DELAY_MS`
(60 s) after the rotator mounts, then it shows one fact at a time under the
BREAK heading and moves to the next every `FUN_FACT_ROTATE_MS` (8 s), fading in
unless the viewer prefers reduced motion. The wait is a client-side timer from
mount, so reloading `/display` during a break restarts it. A single fact stays
put; an empty list draws nothing, leaving the break card as before.

**The phone's verdict card.** When the big screen lands on a revealed question
(a live forward move: not on connect or reconnect, not on Previous), every
phone shows a card for about three seconds that never blocks input: "✓ Correct
+2", "Close! +3" (a `partial` verdict, with the actual points), "✗ +0", or
"No answer". It does not depend on the phone's auto-advance setting and is
built from the team's own answer data; only a `correct` verdict vibrates. For a
closest_guess question it appears when the answer step comes on air.

### Events

Every event is declared once, in the **protocol map**
(`shared/types/src/socket-protocol.ts`): its wire name (the `SOCKET_EVENTS`
constants), its payload and, for client → server events, what its
acknowledgement carries. The map is types only. The clients open sockets typed
by it (`socket.io-client`'s generics), so a wrong payload, a wrong
acknowledgement type or a listener typed against the wrong view is a compile
error. `STATE_SYNC` and `STATE_UPDATED` are declared per room, so a socket
connected as `players` receives `PlayersStatePayload` on them and nothing else.

Server → client: `STATE_SYNC`, `STATE_UPDATED` (both per room), `JOIN_ACCEPTED`,
`ANSWER_RECEIVED`, `ANSWERS_UPDATED` (admin only — contains answer values),
`PRESENTER_CONTEXT_UPDATED` (admin only — host notes and next-screen preview),
`TEAM_ANSWERS_SYNCED`, `TEAM_PLAYER_COUNT_SYNCED` (`{ playerCount }`, to the
team's own phone only), `BONUS_AWARDED`, `SESSION_CLOSED`, `TEAM_KICKED` (no
payload), plus the connection's `exception` message.

Client → server: `ADMIN_ACTION`, `GRADE_ANSWER`, `KICK_TEAM`, `SET_TEAM_PLAYER_COUNT`, `AWARD_BONUS`,
`SET_BREAK_END_TIME`, `SET_DISPLAY_TEXT_SCALE`, `SET_DISPLAY_SOUND_MUTED`
(`{ isDisplaySoundMuted: boolean }`) and `CREATE_SHOWDOWN_ROUND` (admin only); `JOIN_PLAYERS`, `SUBMIT_ANSWER`, `LEAVE_SESSION`, `RATE_ROUND`,
`SEND_FEEDBACK`, `SET_PLAYER_COUNT` and `SUBMIT_SHOWDOWN_GUESS` (players only). Every one is
acknowledged with `AckResult`. Room
membership is checked server-side on every handler; violations raise
`WsException`. Quiz listing/creation and session lifecycle (list, start,
close) now go over REST (`/quizzes`, `/sessions`) rather than sockets — see
[Sessions](#sessions-running-multiple-quizzes-at-once).

`RATE_ROUND` — `{ roundId, stars }`, `stars` 1–5 in half-star steps (Zod-validated) —
saves a team's **round rating** for one round of the break card or the final form. The ack is the
result: `{ success: true }` once saved, or an error with a reason — "Feedback is off
for this session" when `collectFeedback` is off, "This round
can't be rated right now" when the round isn't in the feedback field's list (a
round outside the current block, a status that is neither a break nor `ended`, or a showdown still being played), or a
validation error for stars outside 1–5 or between half stars. The team is the one whose socket sent
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

`SET_PLAYER_COUNT` — `{ playerCount }` — saves the team's **player count**: how many
players it brought to this session. `playerCount` must be a whole number from 1 to 20
(Zod-validated, so 0, 21, 2.5 and a string are refused). The ack is the result:
`{ success: true }` once saved, or an error with a reason — "Join a team before
reporting your player count" for a socket with no team link. It is allowed at any
status, in the lobby and mid-quiz alike, and never touches scores. One row is kept per
(session, team) in `session_player_counts` (unique on both, cascading from both);
it is not stored on the roster row because a kick deletes that row and the count must
survive a kick and a rejoin. Setting it again replaces the number (last write wins);
there is no way to clear it back to unknown. It goes through the session write,
declaring that it doesn't change scores, and broadcasts no room view: the display view
and the players view are untouched. Instead the server sends `TEAM_PLAYER_COUNT_SYNCED`
(`{ playerCount }`) to the team's connected phone through the per-team sync (the path
that also carries the team's answers), so a team's count never reaches another team.
The service that reads and writes it is `PlayerCountService`
(`apps/backend/src/player-count/`).

`SET_TEAM_PLAYER_COUNT` — `{ teamId, playerCount }` — lets the quiz master or a
moderator set or correct any team's player count from the Teams panel at any status.
It is admin-room gated like `KICK_TEAM` (so it is allowed for admins and moderators
and refused, with "Only admin clients may set a team’s player count", from any other
room) and uses the same Zod validation as `SET_PLAYER_COUNT` (a whole number from 1
to 20). The ack is the result: `{ success: true }` once saved, or an error with a
reason — "Team N is not in this session" for a team that was never on this session's
roster. A team removed by a kick or leave still counts if it left a record: a reported
number, or graded answers or bonus awards (the standings' record of a departed team).
A team removed before it left any record is not recoverable and is refused. Both
player count events are refused once the session is closed (its state is evicted, so the
write fails with an unknown-session error). It writes the same per-team, per-session row as the
phone's event (last write wins, so the team's later report overwrites the correction
and vice versa) and reaches the team's phones through the same `TEAM_PLAYER_COUNT_SYNCED`
per-team sync; a team with no connected phone gets the number on its next join. The
big screen and the players view are untouched. The admin room alone is sent a fresh
`STATE_UPDATED` (the outcome's `shouldBroadcastAdminState`), after this event and
after a team's own `SET_PLAYER_COUNT`, so an open `/control` shows the new number.

**Player count in the admin view.** Each entry of the admin view's `teams` (an
`AdminTeamView`) carries, besides `teamId`, `teamName` and `isConnected`,
`playerCount` (`number | null`, null until the team or the quiz master has set one) and
`isOverPlayerCap` (`boolean`). The server sets `isOverPlayerCap` when `playerCount`
is above the session's `maxPlayersPerTeam` setting, so changing that setting in the
lobby changes the flag and `/control` doesn't repeat the rule. The display and
players views keep the plain `TeamView` entries without either field. The session
caches the counts (`SessionState.playerCounts`, filled as teams join and as counts
are set) so the view stays synchronous; the database row remains the source of truth.
The flag is information only: no penalty is applied, and the quiz master can still
give the house-rules penalty as a bonus award.

Answer _content_ only ever goes to the admin room and the answering team
itself — the display and other players just see counts.

## Answer Lifecycle

1. **Submit** — a player sends `SUBMIT_ANSWER` for any question in
   `blockQuestions`. The server rejects submissions for questions outside the
   open block ("Answers are locked for this question") — locking is enforced
   server-side, not just hidden in the UI. The answer is graded against the
   question as the session holds it (the same copy the big screen, lock-time
   grading and key fixes use), never re-read from the question table; hand
   grading likewise looks the answer's question up in the session and refuses an
   answer to a question the session doesn't hold.
2. **Upsert** — answers are keyed `(gameSession, question, team)`;
   re-submitting overwrites (last-write-wins is the desired pub-quiz behavior).
3. **Acknowledge** — the submitter gets `ANSWER_RECEIVED`, which the phone
   uses to tick its checkmarks and flash a short "Saved ✓" (an accepted
   submit only, never a refused one); the admin room gets the full `ANSWERS_UPDATED`
   list; everyone gets a fresh snapshot whose `answeredTeamIds` drives the
   admin's per-team ✓ marks and the display's "X of Y teams answered" counter.
4. **Grade** — the admin can grade an answer as soon as it arrives (0 / half
   / full points, where half is exactly half the question's points: 0.5 on a
   1-point question), and must finish any remaining grading in the `break`:
   leaving it is refused while an answer in the block is ungraded. If a team
   changes a hand-graded (`free_text`) answer, its grade is cleared,
   since it belonged to the old value. Grades are written to the answer row;
   grading an answer twice is prevented in the UI. Exception: `closest_guess` answers are graded automatically once the
   block locks and reject a manual `GRADE_ANSWER` until then — see
   [Question Types](#question-types).
5. **Bonus points** — separately from per-question grading, the admin can
   award ad-hoc bonus points (`AWARD_BONUS`; categories like `shot`, `selfie`,
   `custom`) to a team at any time, also folded into the leaderboard. The
   awarded team's phone shows a toast for a new award (category, signed points
   and, for `custom`, the reason; about 8 seconds, success-styled for a bonus,
   plain for a penalty) — not for edits, deletions or awards restored on
   rejoin, which only appear in the bonus drawer.
   The quiz master gets a success toast on `/control` once the server accepts
   the award (e.g. "+1 Selfie → The Quizzly Bears"), whether or not the team's
   phone is connected; a refused award shows only the error toast and the
   dialog stays open.
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
a phone that reconnects marks them "Sent ✓". The team's **player count** rides along
too (`playerCount`, `number | null`, null until it reported one), so a reconnect, a
second phone or a rejoin after a kick (with the team code) shows it again.

On the phone, the lobby screen keeps "You're in!", "Look for (team name) on the big
screen", the waiting line and the rules link, and adds a **player count card**: "How
many players are you?" with a − / + stepper limited to 1–20 and a Send button. Send
shows "Saved ✓" once the server acknowledges it, or a "Not saved — try again" retry
when it was refused or failed. Once a count is saved the card folds into "(n) players ·
edit", which reopens it. Answering is optional and never blocks the phone. The count can
be changed at any status from the "Players in your team" field of the settings modal
(same stepper and feedback). A team that joins after the lobby with no count gets the
same card once, over whatever screen it lands on, with a Dismiss control; dismissing is
remembered on that phone and session in `localStorage` (the card still works when
storage is blocked). A team that already has a count never sees the prompt.

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
- **Waking a phone** — mobile OSes freeze a backgrounded socket, so `/play`
  opens a fresh connection (`forceReconnect`) when the page turns visible after
  being hidden for at least `HIDDEN_RECONNECT_THRESHOLD_MS` (5 s), when it is
  restored from the back/forward cache (`pageshow` with `persisted`), and when
  the network returns (`online`). The rejoin goes through the normal join path,
  naming the earlier socket as `previousSocketId` so the team keeps its seat. A
  shorter hide changes nothing.
- **Kick** — the admin can remove a team from the _current session's roster_
  (`KICK_TEAM`) without touching the underlying `Team` entity or its answer
  history; a kicked team's persistent identity and past scores survive. The
  Teams panel on `/control` offers Kick for every team, connected or not. A
  connected team's socket gets `TEAM_KICKED` and is closed; its phone then
  forgets its stored token, name and team code, so it can rejoin under the
  same name only with the team's recovery code.
- **Reconnecting bar** — while a joined phone's socket is retrying, `/play`
  shows a full-width magenta bar fixed to the top ("Connection lost —
  reconnecting…", `role="alert"`). After `RECONNECT_HELP_DELAY_MS` (10 s)
  without reconnecting it adds a "Tap to reconnect" button that forces a fresh
  connection (`forceReconnect`); the rejoin goes through the normal join path.
  Join refusals and the kick notice keep their inline text.

**One device per team.** A team's seat (`connectedTeamSockets[teamId]`) is held
by one live socket, and answers are accepted only from it ("You may only submit
answers for your own team" otherwise). A join is refused ("… is already
connected on another device") while a different live socket holds the seat,
unless it names that socket as `previousSocketId`: only the device that held
it knows the id, so a phone reconnecting before the server's ping timeout
(~45 s) noticed its old socket died takes the seat over.

The phone cannot always name the socket that holds the seat (a reload, or a
reply lost on a socket that then died). It treats these as recoverable, never as
a dead end:

- A rejoin refused only because another socket holds the seat is not shown to a
  phone that already proved who it is (it was linked, or holds the team's
  token). The phone asks again every 3 s on the same connection, up to 20 times
  (longer than the ping timeout), then shows the refusal. A second phone with
  only the recovery code still sees the refusal at once.
- The answer form is offered only while the server confirms this connection
  holds the seat (the join was accepted on it), so a reconnecting phone never
  shows a form whose submit would be refused.
- If an answer is refused as "not your own team" anyway, the phone drops its
  link, rejoins by itself and sends the answer again once the join is accepted.
  No error is shown for the seat refusal itself; if the resend is refused for
  another reason (e.g. the block locked meanwhile) the player sees that reason
  as a toast and the answer is dropped.

## Question Types

`QuestionType` is one of `free_text`, `multiple_choice`, `sort`, `match`,
`closest_guess`, or `number`. Each has its own submission format and
grading behavior. Media is not a type: any question can carry a
`media_url` and an `answer_media_url` (see [Media on any question](#media-on-any-question)).

- **`free_text`** — any typed answer (`FreeTextAnswer`). An answer matching
  the stored `answer` (trimmed, case-insensitive, so "Paris"/" paris "/"PARIS"
  all match) is graded correct at submit time. Any other answer is left
  ungraded for the admin — a synonym or typo worth accepting, or a plain
  miss. The admin can override any answer, matching or not.
- **`multiple_choice`** — players pick one of `options`. Auto-graded at
  submit time by exact match against the stored `answer`.
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
  `GRADE_ANSWER` on one of these until the batch has graded it. Once the
  block locks, `BlockGradingService` batch-grades every submission, awarding
  full points to whichever team(s) are numerically closest to the answer
  (ties share full points) and 0 to everyone else, caching the reveal summary
  per question (`closestGuessSummaries`) since it only needs computing once.
  The press that locks the block sends `/control` the graded answer list
  (`ANSWERS_UPDATED`). From then on the admin can override any team's grade
  like any other type. The summary lives in memory only: after a backend
  restart it is rebuilt from the stored guesses without re-scoring, so
  overrides survive; "already graded" is read from the stored answers. The
  reveal's closest team(s) are always the numerically closest guesses, even
  when an override gave another team points. During
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
- **`number`** — a number graded against a **margin** (ADR 0003). The CSV
  `answer` cell holds the key and must parse as a finite number (same rule and
  message as `closest_guess`); players type on the decimal number keypad. The
  question's `margin` is `{ value, unit }` with `unit` `percent` or `absolute`
  (stored in the payload next to `matchScoringMode`, set in the manual editor
  only — never from CSV, so an imported question, and one with no stored
  margin, gets the default `{ value: 10, unit: 'percent' }`). The value must
  not be negative and a percentage must be at most 100. It is **auto-graded at
  submit**: with `allowed` = the margin value (absolute) or `|key| × value / 100`
  (percent), an answer with `|answer − key| <= allowed` is correct with full
  points (edges included) and anything else, including an answer that isn't a
  finite number, is incorrect. A key of 0 with a percentage margin therefore
  accepts only an exact 0, and a margin of 0 accepts only the exact key. There
  is no partial credit, a Number answer is never ungraded, and the admin can
  override any grade. **Editor:** a Number question shows a margin row next
  to the answer (a number field, decimals allowed, plus a `%` / `absolute`
  toggle, 10% on a new question); a key of 0 with a percentage margin shows an
  advisory hint, not an error. Switching Free text to Number keeps the prompt
  and keeps the answer only if it parses as a number. **CSV:** there is no
  margin column (like match's scoring mode): import fills in 10% and export
  writes no margin, so a custom margin is lost on export → re-import.
  Changing the margin of an opened question is a grading-input change like a
  key fix and re-scores its answers, discarding manual overrides.
  Allowed in kahoot rounds, where a correct answer is
  scaled by the speed multiplier. While the question is open, the phone (under
  the prompt) and the big screen show the margin ("within 10%", "within 5");
  on reveal both show the key and the accepted range ("200 · 180–220
  accepted"; just the key when the margin is 0). The text comes from one
  shared formatter (`formatMarginText`/`formatNumberReveal` in
  `shared/types/src/margin.ts`), numbers show at most 2 decimals with trailing
  zeros dropped, and grading always uses the exact range. A question view (the
  open question, the block questions and the reveal questions) carries `margin`
  if and only if its type has one, already resolved from the Answer key: a
  Number question with no stored margin is sent with the default, and
  `closest_guess` and every other type are sent without one. The screens show
  margin text from the view alone and never ask the question type registry.

### Media on any question

There is deliberately no picture, audio or YouTube type: any question can
carry a `media_url` and an `answer_media_url`, and the display works out from
the URL whether it is an image, an `<audio controls>` element (autoplaying)
an embedded YouTube iframe, or a `<video>` for a video file. A question's type
only decides how teams answer and how the answer is graded, so a music
multiple choice is a `multiple_choice` row with an mp3 `media_url`. Media is
never required. (Questions saved as `audio` or `youtube` before this were
re-typed by a migration: `multiple_choice` when they had choices, `free_text`
otherwise.)

**Video files.** A link ending in `.mp4`, `.webm`, `.mov` or `.m4v`
(case-insensitive, a `?query` is fine) is a video file, recognised by
`classifyMediaUrl` in `shared/types/src/media.ts` (the one place that infers
image / audio / YouTube / video file from a link; `isVideoUrl` is "YouTube or
video file"). Hosting pages (Vimeo, Google Drive, Dropbox share links) are not
direct files and are not recognised. On `/display` it is a `<video>` with no
controls, `playsInline` and `autoPlay` from `autoplayMedia`, in the same 16:9
box as YouTube (and the same fullscreen overlay, without remounting). The
reveal rule is worded over video: a video `answer_media_url` (YouTube or file,
either source) replaces the question media at reveal; otherwise the question
video plays again. The side-by-side image reveal is unchanged. If the file
fails to load (`error` event) the display hides the video area for that media
and leaves the prompt and answers; there is no retry and no message. Venue
internet carries the video, so link short, compressed clips. Uploading video
is not supported (`POST /media` stays images-only).

A clip's start/end (seconds
into the video) are real question fields (`mediaStartSeconds`/
`mediaEndSeconds` on the draft, the preview and the JSON `payload`
alongside `mediaUrl`); the editor shows them as the "Clip start"/"Clip end"
inputs for any video `media_url` (YouTube or video file). On the big screen
a YouTube clip is the embed's `start`/`end` params; a video file's clip is a
media fragment on the `<video>` src (`#t=start,end`, either bound optional,
an empty clip leaves the url bare). The `notes` cell of a CSV row carries
them as CSV-only syntax: one `{…}` group anywhere in the notes, e.g.
`{start: "1:22", end: "2:20"}` (`M:SS`, `H:MM:SS`, or plain seconds all
parse; quotes optional; the older `YouTube clip: {…}` line still imports).
It isn't strict JSON: one lenient parser (`parseClipNotes` in
`shared/types/src/youtube.ts`) reads the keys `start`, `end`, `revealStart`,
`revealEnd` and `hideVideo: true`, and returns the notes with the group
removed, so notes without that syntax stay a normal free-text note. A
clip time that doesn't parse (e.g. `start: "1:2x"`) is never dropped
silently: a CSV row with one is reported as invalid on its `notes` column,
and in the editor an unreadable "Clip start"/"Reveal end" etc. is rejected at
save ("Clip times must be whole seconds"); a blank one just means the whole
video. CSV import moves the group out of the notes into the fields (only when
`media_url` or `answer_media_url` is a video, YouTube or file; `start`/`end` only fill
the clip when `media_url` is); CSV export writes the fields back as one
canonical group appended to the free notes, leaving empty keys out. Stored
`notes` are free text only: loading a stored question strips any clip group
an older save left there (the payload fields stay the truth), and saving
again cleans the row. The **reveal clip** (`revealStartSeconds`/
`revealEndSeconds`, in the notes group as `revealStart`/`revealEnd`) is the
start/end of the one video played at reveal, and applies when either
`media_url` or `answer_media_url` is a video (the editor labels the
inputs "Answer video clip" when `answer_media_url` is a video, otherwise
"Reveal clip (question video)"). At reveal exactly one video plays: a
video `answer_media_url` replaces the question video, clipped by the
reveal clip; otherwise the question video plays again (restarted, unless it
is a hidden video, which just lifts its cover), clipped by the reveal clip,
not the question clip. An empty reveal start/end means the whole video. The
question clip (`start`/`end`) still applies only while the question is
asked. Reveal views carry the reveal clip (it is on `SeededQuestion`, like
`answerMediaUrl`, never on the pre-reveal `QuestionView`). **Hidden video:**
the "Hide video (sound only)" checkbox (`isVideoHidden` on the draft,
preview, payload and question views; `hideVideo: true` in the CSV notes
group) shows for any video `media_url` (YouTube or file). The big screen keeps
the player (iframe or `<video>`) mounted at full size (a hidden or zero-size player may not autoplay) under an
opaque panel with a 🎵 label, while the question is asked and in break
review; the panel comes off at reveal without remounting the player. Phones
show "🎧 Listen" in place of "👀 Look at the screen". A stored payload
without the field reads as not hidden.

`multiple_choice`/`sort`/`match`/`number` are auto-graded the instant a team
submits, and the admin can still override any of them per answer;
`free_text` (grading mode `match-or-human`) is graded
correct at submit when the answer matches the key and otherwise left ungraded
for the admin, who can override any of them too. A revision that matches is
graded correct (replacing any earlier grade); a revision that doesn't match
and differs from the previous value goes back to ungraded, even if the admin
had graded the previous value; resubmitting the same value leaves its grade
alone. `closest_guess` is auto-graded
but deferred to a single batch pass once the block locks, and can be
overridden only after that pass; every other type can be overridden at any
time. Which list each type is in (auto-graded, kahoot-allowed) is defined once per type in the question type
registry (`QUESTION_KINDS`, `shared/types/src/question-kind.ts`).

Every answer in the admin answer list (the `ANSWERS_UPDATED` payload and the
REST answer list) carries a **grading state** the Grading policy works out from
the same rule that refuses a hand grade: `graded` (it has a grade), `ungraded`
(no grade yet and the quiz master can grade it now) or `awaiting_batch` (no
grade yet and graded by its question's batch when the block locks, so it can't
be hand-graded before then). `/control` renders the state it is sent and never
asks the question type. The team's own answer view carries no grading state.

Every question also has one **answer kind** — `text`, `number`, `choice`,
`sort` or `match` — resolved from its type alone by `resolveAnswerKind`
(`shared/types/src/answer-kind.ts`). `multiple_choice` is the only type that
carries choices and is always `choice`; every other type takes its registry
input kind, whatever `options` it carries. Each answer kind has one answer format (`ANSWER_FORMATS`) that decodes,
encodes, formats and scores a stored answer, and Scoring takes its base score
from it. `closest_guess` shares the `number` kind but is never scored one
answer at a time: the Grading policy's `gradeAtSubmit` gives a batch type no
grade at submit and the batch grader decides its result. Any type can
carry `media_url`/`answer_media_url` — image vs. audio vs. YouTube is inferred
from the URL, so there is deliberately no picture, audio or YouTube type.

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
session on it is running (any status other than `lobby`/`ended`). Five rules
apply while live, enforced by `findLiveEditViolations`
(`apps/backend/src/quiz/live-edit-guard.ts`) as a `409` and mirrored in the
editor's disabled controls:

- **Nothing the sessions have reached moves.** Game progress is
  positional (`roundIndex`/`questionIndex`), so a shift would move the game
  onto a different question, and deleting a question cascades to its teams'
  answers. The line is the **live-edit frontier** (`LiveEditFrontier`,
  `shared/types/src/live-edit-frontier.ts`): the opened questions, the
  current round of the live sessions on the quiz, merged — with two sessions
  at different points the line is the further-on one's current round — and
  whether the current block has started locking (`hasCurrentBlockStartedLocking`:
  status `locking`, or a break or reveal status). Both the guard and the
  editor read it through `getRoundStructureEditing` (`frozen`,
  `after-opened` or `free` per round), and `GET /quizzes/:id` returns it as
  `liveEdit`. The current round and every earlier round keep their place,
  `breakAfter` and `kahootMode` (`isRoundReached`) and can't be deleted, even
  while only the current round's title card is on screen; a round before the
  current round keeps exactly its questions in their order.
- **The current round keeps its opened questions, nothing else.** Until its
  block starts locking, the questions after the last opened one can be
  added, deleted, reordered and moved to a later round (or in from one);
  the opened questions stay at the start of the round, in order — inserting
  before or between them, or moving one, is refused with a `409`. Teams'
  phones only get questions up to the furthest opened one, so nobody sees the
  change until a question opens, and the next press opens whatever now sits
  after the opened question. Once the block starts locking, and through its
  break and reveal, the round is frozen like an earlier one: adding a
  question then would put the locking countdown on a question that's no
  longer last, or add an unanswerable question to a locked block. The editor
  says so and suggests a later round. A round must keep at least one question
  (the usual empty-round validation). If Previous steps back before the
  furthest opened round, that round stays frozen — its block may already have
  locked.
- **After the current round, rounds are free.** Whole rounds after the
  current round of every live session can be added, deleted and reordered,
  and their `breakAfter` and `kahootMode` can change (the usual rules still
  apply: kahoot-allowed question types, the last round always breaks). Turning
  on `breakAfter` for a later round moves where the current block ends, which
  only moves the line across questions nobody has opened. Deleting every round
  after the current one ends the quiz there. Rounds are saved by position, so
  moving a round rewrites rows by position — harmless, since only unopened
  rounds move and they have no answers or round ratings yet; ratings of played
  rounds are untouched. After the save the sessions' breaks follow the edited
  rounds (the structure is data). Removing, moving or changing the break or
  kahoot setting of a round at or before the current one is refused with a
  `409`, and the editor disables those controls.
- **After the current round, questions are free.** In any round after the
  current round of every live session, questions can be added, deleted,
  reordered and moved to another such round (the editor's "Move to…" select),
  and the sessions play them in their new places when they reach them. The
  frontier is checked and applied while the live sessions are held: the
  Live edit module (`apps/backend/src/game/live-edit/live-edit.service.ts`)
  holds every unfinished session on the quiz's write queue, decides which are
  running, merges their frontiers, checks the draft, saves, then reloads each
  session (regrading opened questions whose answer or points changed) and
  delivers the outcomes once the hold is released. The game can't move past
  the frontier during a save, so a save either lands with every session still
  behind the frontier it was checked against, or is refused with a `409`
  naming that round when a press opened a question in, or started locking, an
  edited round just before it — and the quiz master reloads (the "Refresh lock
  state" button). A save waits for a press already in flight on a session of
  the quiz; sessions on other quizzes aren't held. The quiz controller only
  maps the module's errors to `409`, `422` and `404`. Only running sessions
  are checked against the frontier and regraded. Every save, with or without
  a running session, also reloads each session still in the `lobby` and
  broadcasts it to every room, so Start quiz plays exactly what the editor
  shows (corrected answers, added and deleted questions, renamed or
  reordered rounds); a lobby session has opened nothing, so it never causes
  a refusal and needs no regrade. Ended sessions are not reloaded. A re-import
  (CSV or Google Sheets link) onto a quiz another session is playing is
  checked the same way: it saves through the Live edit module, matching each sheet row to
  the stored question at the same round and position, so it is refused with
  a `409` and the same issue list when it would change what that session has
  reached, and otherwise applied under its held writes. The importing
  session's own lobby-or-ended rule stays, and its screens are sent the new
  rounds after the save (a lobby session once, by the general lobby reload;
  an ended session by the re-import's explicit reload).
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
If an opened question's Answer key (its `answer`, `points` and the
`matchScoringMode` or `margin` its type carries) changed, its existing answers are
re-graded (`BlockGradingService.regradeForKeyFix`): auto-graded types
(`multiple_choice`/`sort`/`match`/`number`) re-score every answer — overwriting any
manual override, e.g. adjusted `match` partial credit — and re-apply kahoot
speed scaling (kept to the nearest half point, so a half-credit match never
rounds back up to full points) from the response time stored on each answer at submit (so it
survives a backend restart, and a correction made before the question locks is
speed-scaled like any other); an already-graded `closest_guess` re-runs its batch,
overwriting any override like the auto-graded types;
`match-or-human` types (`free_text` only) grade answers that
match the corrected key correct, keep the admin's grade on a non-matching
answer, and send any other non-matching answer back to ungraded — including
one that was auto-graded correct under the old key (told apart by re-running
the submit-time grade against the key as it stood before the edit). The editor keeps sort/match
display order stable across saves (`savedDisplayOrder`), so a re-save doesn't
reshuffle what players see. The keys are compared with defaults filled in
(`answerKeyOf` / `isSameAnswerKey`), so a setting left unset and one saved as
its default are the same: a CSV-imported `match` question (no stored scoring
mode) saved as `partial` is not a key fix and keeps its overrides. A setting
the type doesn't carry never counts, and a margin compares by value and unit
whatever the order of its fields.

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

`type` is one of the six [Question Types](#question-types) above — see
that section for what each needs in `options` and `answer`. A row typed
`audio` or `youtube` (an older export) is rejected on its `type` cell with
`Question type "audio" was removed — use free_text (or multiple_choice if the
row has options) and keep the media_url.`; there are no silent aliases.
`media_url` is optional on every type (see
[Media on any question](#media-on-any-question)). `answer_media_url` is
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

**Player counts** show how many people came. They are read from the
per-session player counts (the table the teams' reports are stored in), joined
through the session and the team and never through the roster, so a team that was
kicked or left keeps its count. A team that reported none is left out of every
total and average, never counted as zero.

- The session detail carries `playerCount: { total, average, reportedTeams }`:
  `total` sums the known counts across every participant (departed teams
  included), `reportedTeams` is how many participants gave a count, and
  `average` is `total ÷ reportedTeams`, `null` when nobody reported. The page
  shows them as the **Total players** tile ("n of m teams reported") and the
  **Avg. team size** tile, both "—" when nobody reported.
- Every standing row, departed rows included, carries `playerCount: number | null`
  (the **Players** column, "—" when unknown).
- Each item of the played-sessions list (`/stats`) carries
  `totalPlayers: number | null`, `null` when nobody in the session reported
  (including every session played before player counts existed); the list shows
  it as the **Players** column, "—" when null. The column is not sortable.

A question's **correct rate** credits each answer by its verdict, never by the
question type: `correct` counts in full (a speed-scaled kahoot answer too),
`partial` counts as its points' share of the question's points (between 0 and 1),
and `incorrect` or ungraded counts nothing. The rate is the summed credit divided
by the participant count, and the hardest and easiest question highlights use it.
The question's correct count (fully correct answers) and a round's correct rate
count only `correct` verdicts.

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

### Team stats

`/teams/:id` shows one team's history across its **ended** sessions, from
`GET /teams/:id` (`TeamHistoryService.detail`; same guards as the stats
endpoints, so admins and moderators). An unknown team id is a 404 and a
non-numeric id a 400. The response is `{ id, name, summary, sessions }`:

- `summary`: `sessionsPlayed`, `wins`, `podiums` (placing 1 to 3), `bestPlacing`,
  `averagePlacing` (one decimal), `averageSharePercent`, `averageTotalPoints` and
  `averagePlayerCount`. The placing figures are `null` when the team has no
  placing; the player count average leaves out sessions with no count and is
  `null` when there are none. The share of max points is each session's total
  divided by its max points, averaged per session, not pooled; a session whose
  quiz has no points to win is left out, and the average is `null` when every
  session is.
- `sessions` (newest first): `gameSessionId`, `name`, `playedAt`, `placing`,
  `placingTo`, `teamCount`, `hasLeft`, `totalPoints`, `maxPoints`,
  `correctCount` and `playerCount`.

Placings come from the Standings service for each session, never from SQL ranks,
so the page agrees with each session's standings table; a tie shares the
competition rank ("Joint 2nd"). A **win** is placing 1 and being the session's
single Standings winner. A session the team was kicked from or left is listed
with `hasLeft: true` and no placing: it counts in `sessionsPlayed` but not in
wins, podiums, best or average placing. The response never carries feedback or
the team code.

The `/teams` directory (`GET /teams`) shows the same figure: each list item
carries `averagePlacing: number | null`, computed by `averagePlacingOf` over
`TeamHistoryService.resultsForTeams`, so the directory and a team's page always
agree. It is `null` for a team with no placing (shown as "—" in the **Avg.
placing** column). `sortBy=averagePlacing` is a sort column alongside `joinedAt`
and `sessionsJoined`; teams with no placing sort last in both directions. Because
placings are not SQL ranks, this sort loads every team's results and orders and
pages them in memory; the other sorts only compute the figure for the visible page.

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
- **Browser E2E** (Playwright, `e2e/`) runs locally only (`pnpm e2e`): it is
  not part of CI, `pnpm test` or the pre-commit hook. See the README's
  "Running E2E".
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
