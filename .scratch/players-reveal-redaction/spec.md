# Spec: The players view redacts the reveal, and names the phone screen

Status: ready-for-agent

Blocked by: None. Source: architecture review 2026-10-02, candidate 3. Builds on `screen-projection`. That spec's user story 21 kept "answers reach phones once reveal starts", which is the leak fixed here. `display-screen-kind` is prior art for the second half, not a dependency.

## Problem Statement

**The reveal leaks to phones ahead of the big screen.** From the moment the quiz enters `reveal_intro`, the players room is sent the just-finished block's `revealQuestions`. That is every question in the block, each with its correct answer (and answer media, and closest-guess stats).

- The big screen walks those answers one at a time by `revealIndex`.
- The phone hides the ones not shown yet with its own filter (`isDisplayRevealed`), but only for points and verdicts.
- The answered-questions list still prints "Correct: …" for every question in the block as soon as `reveal_intro` is up. A team that opens its history during the first round title card can read the whole answer key before the quiz master reveals it.
- Even where the filter works, the answers are on the wire. Anyone looking at the socket traffic has them.

This breaks the constraint in `CLAUDE.md`: anything teams mustn't see yet is removed server-side, never filtered by the client. The comment on the phone's seen-questions merge says the players view never carries an unshown question, and today that's false.

**The phone works out its own screen.** `/play` decides what to draw from about ten raw checks:

- `progress.status`
- `isLeaderboardVisible`
- `isAnswerable`
- whether `roundTitleCard` is set
- whether a question is selected
- `activeShowdown`
- `showdownRevealStep`
- …

The checks are spread across the game-status screens component and the page's block-browser condition, and nothing makes them exhaustive. `/display` is moving to render by the On-air screen's kind (`display-screen-kind`). The phone is the last client that still rebuilds the screen choice from game state.

## Solution

**The players view only carries answers the big screen has already shown.** The Screen projection's players case trims `revealQuestions` to the reveal walk so far:

- every question before `revealIndex`
- the question at `revealIndex`, once its `reveal` step is on air (not during its round's `reveal_intro` card)

The phone stops filtering. It shows a correct answer whenever one arrives, because the server only sends answers that have been shown.

**The players view names the phone screen.** Next to the existing view, the projection returns a `phoneScreen` with a `kind`, decided on the server from the same snapshot that names the On-air screen. `/play` switches on that kind, the way `/display` switches on `onAirScreen.kind`. `phoneScreen` replaces the two loose fields the phone reads today (`onScreenQuestionId`, `roundTitleCard`).

To teams, nothing changes except one thing: the answer key no longer appears early in the history list.

## User Stories

1. As a team, I want my answer history to show a question's correct answer only once the big screen has revealed it, so that the reveal is a shared moment and not spoiled by my phone.
2. As a team, I want the question the big screen is revealing to show its correct answer and my points on my phone at the same moment, as today.
3. As a team, I want questions the big screen has already revealed earlier in the walk to keep showing their correct answer and points, as today.
4. As a team, I want the next round's title card during the reveal not to unlock that round's first answer on my phone, so that the card stays a pause before the answer.
5. As a team, I want my phone to show the same answers after a reconnect as a phone that stayed connected, so that a sleeping phone isn't treated differently.
6. As a team, when the quiz master steps back with Previous during the reveal, I want my phone to stop showing answers the big screen has stepped back past, so that my phone keeps matching the big screen.
7. As a team, I want older blocks' answers to stay in my history once their reveal is finished, as today.
8. As a quiz master, I want to know that no correct answer reaches a phone before I reveal it on stage, so that a team watching socket traffic can't get ahead.
9. As a team, I want the lobby, rules, round overview, round title cards, leaderboard, block browser, "Quiz complete!", and showdown screens to appear exactly when they do today, so that this change is invisible apart from the fix.
10. As a team, I want a kahoot question that's open behind the leaderboard to stay hidden until the board comes down, as today.
11. As a team, I want to keep answering an open question while the leaderboard covers the big screen, as today.
12. As a team, I want Previous stepping back into an already-open round's title card to keep my block browser up, so that I can keep answering.
13. As a team in a showdown, I want my phone to show the guess form while guesses are open, and the showdown reveal once it starts, as today.
14. As a team not in a showdown, I want a "look at the screen" tiebreaker message, as today.
15. As a developer, I want the phone's screen choice decided once, on the server, so that a new status or a changed precedence is a single edit.
16. As a developer, I want `/play` to fail to compile when a new phone screen kind is added without a drawing for it, so that a phone can't silently render blank.
17. As a developer, I want one pure test per phone screen kind at the projection, so that the screen rules are tested without rendering React.
18. As a developer, I want the client-side reveal filter deleted, so that there's no second copy of "what has been shown" to drift out of sync.

## Implementation Decisions

### Reveal redaction (Screen projection, players case)

- **The trim happens after the On-air screen and the players-screen fields are computed.** Those read the untrimmed `revealQuestions` (the `reveal_intro` card needs the upcoming question's round title). Only the outgoing `revealQuestions` array is trimmed.
- **Rule:** keep a question when its position in the block is before `revealIndex`, or equal to `revealIndex` while the status is `reveal`. This is the same rule the phone applies today, moved to the server. In `reveal_intro` at the block's first position, the list is empty.
- **The leaderboard flag doesn't affect the trim.** The board covering the reveal doesn't change what has been shown underneath it.
- **Only the players room changes.** The display and admin views keep the full block: the big screen needs the next answer ready, and `/control` shows the key.
- **The trim is a removal, not a mask.** Trimmed questions are still in `blockQuestions` (no answer), so the phone's picker and history keep every block question.
- **Unchanged:** `pastRevealedQuestions` is already safe (finished blocks only), and the kahoot hidden-question redaction stays as it is.

### Phone stops filtering

- The phone's opened-questions builder drops its reveal-walk parameter and the `isDisplayRevealed` check. A question counts as revealed when it arrives with an answer, and then its points and verdict show.
- The seen-questions merge keeps its order: block questions first, then reveal questions, then past reveals. That order now gives the right result after Previous. A question the walk stepped back past arrives only as a block question, so it overwrites the earlier revealed copy and its answer disappears again. That matches a phone reconnecting at the same point. Its comment becomes true as written.
- The question browser's per-question reveal (correct answer next to "your answer") keeps looking the selected question up in `revealQuestions`. With the trim, that lookup only finds shown questions.

### Phone screen kind

- **`describePlayersScreen` (shared types) returns a `phoneScreen` instead of `onScreenQuestionId` / `roundTitleCard`.** `PlayersScreenFields` becomes `{ phoneScreen: PhoneScreen }`. The projection passes it the two server-only facts it needs: whether the block is answerable, and whether a kahoot question is hidden behind the board.
- **Kinds, and when each applies (first match wins):**
  - `leaderboard`: the board is up and the block isn't answerable. This includes a kahoot question hidden behind the board.
  - `block`, carrying `onScreenQuestionId` (the question the big screen is revealing, else null): the block is answerable (any status, including a round intro re-entered by Previous, or the board covering an open question), or the status is a block-review status (break statuses, `reveal_intro` with no title card, `reveal`).
  - `lobby`, `rules`, `round_overview`: their statuses.
  - `round_title`, carrying the `title`: a fresh `round_intro` (block not answerable) with the round's title, or a `reveal_intro` / `break_round_intro` card with the round title resolved from the reveal index, as `roundTitleCard` is today.
  - `ended`: ended with no active showdown.
  - `showdown_guessing`: ended with an active showdown whose reveal step is 0.
  - `showdown_reveal`: ended with an active showdown whose reveal step is above 0.
- **Not in the kind: which team you are.** The players room is one broadcast for every team. So on `showdown_guessing`, the phone still chooses between the guess form and the "Tiebreaker in progress" message by checking whether its own team id is a participant. That's identity, not game logic.
- **`/play` switches on `phoneScreen.kind`** with one case per kind and a never-check. The status chain in the game-status screens component and the page's block-browser condition are deleted. The `block` case still needs a selected question; if there isn't one, it renders nothing, as today.
- **Each kind keeps today's drawing.** The kinds don't carry data the snapshot already has (questions, showdown, settings); the page reads those from the snapshot as now.
- **Not part of the screen choice, so unchanged:** auto-advance and the `revealSyncKey` follow logic (now reading `onScreenQuestionId` from the `block` kind), the bonus panel, and the mobile action bar.

### Docs

- `DOCUMENTATION.md`, the protocol section on per-room views: the players view carries only the reveal walk so far, and names the phone screen.
- `CONTEXT.md`: add **phone screen** next to the On-air screen entry, meaning the screen a team's phone shows, named by the server.
- The moderator `/guide` page is unchanged, because nothing on `/control` changes.

## Testing Decisions

Two seams, both existing. No new seam is introduced.

- **What makes a good test:** build a session (or a snapshot), call the public entry point, and assert what an audience receives or sees. Don't assert which helper ran or how the trim is implemented.
- **Seam 1: the Screen projection, `projectScreen(session, 'players')`.** Pure backend Jest tests from a session fixture. Prior art: the admin flags projection spec (`apps/backend/src/game/__tests__/admin-flags-projection.spec.ts`).
  - Reveal trim:
    - `reveal_intro` at position 0: no reveal questions
    - `reveal` at position 0: one question, with its answer
    - `reveal` at position 2: three questions
    - `reveal_intro` crossing into a second round at position 2: two questions, and the round title card still names the upcoming round
    - the board toggled on mid-reveal: same trim
    - display and admin views at the same point: the full block
  - One case per phone screen kind, plus the precedence edges:
    - board up over an open answerable question → `block`
    - board up over a hidden kahoot question → `leaderboard`
    - Previous into an already-open round's intro → `block`
    - fresh round intro → `round_title`
    - ended with and without a showdown, and showdown step 0 vs above 0
- **Seam 2: `/play` rendered from a snapshot.** Vitest with the mocked player-game hook. Prior art: the existing `/play` test files (`break-and-reveal`, `leaderboard-overlay`, `pre-game-screens`, `answered-questions`).
  - The existing tests keep their assertions on what is on screen. Their snapshot fixtures gain a `phoneScreen` (and lose `onScreenQuestionId` / `roundTitleCard`), the same kind of fixture change `display-screen-kind` makes.
  - New: a block-review snapshot whose trimmed `revealQuestions` holds only the shown question. The history list shows "Correct:" for that question and not for the block's other questions.
  - New: after a snapshot that steps back (one fewer reveal question), that question's correct answer is no longer shown.
- **The opened-questions unit test** loses its reveal-walk cases (that logic moves to seam 1) and keeps the pairing and points cases.
- The type-level exhaustiveness of the `/play` switch needs no runtime test: the build is the check.

## Out of Scope

- **Closest-guess step data.** The revealed closest-guess question still carries all of its step stats (min, max, closest teams) at once, while the big screen walks `closestGuessRevealStep`. The phone gates those steps client-side, the same way `/display` does. Trimming them per step is a separate, smaller leak.
- **The final block after `ended`.** It's in neither `revealQuestions` nor `pastRevealedQuestions`, so a phone that reconnects after the quiz ends loses that block's answers from its history. That's a reconnect gap, not a leak.
- **Per-team views.** The players room stays one broadcast. Anything that depends on which team a phone belongs to stays on the phone, keyed by its own team id.
- **Visual changes** to any phone screen.

## Further Notes

- **Two independent slices that can ship separately.** Do the redaction first: it's the constraint breach, it touches only the projection and the phone's filter, and it can't change any screen choice. Then the phone screen kind, which is a pure refactor on top.
- **Follow-up after the phone screen kind lands:** the phone's block-review status group (`BLOCK_REVIEW_STATUSES` / `isBlockReviewStatus`) may have no frontend callers left. Check, and fold or delete it then.
