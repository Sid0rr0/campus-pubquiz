# Campus Pub Quiz — Domain Language

A live pub quiz: a quiz master runs the game, a big screen shows it, and teams answer on their phones.

## Quiz structure

**Round**:
A titled group of questions in a quiz, shown to teams under one round intro.

**Block**:
A run of consecutive rounds that is graded and revealed together, ending at a round marked to break after it. The last round always ends a block.
_Avoid_: section, segment, grading group

**Kahoot round**:
A round where every question is its own block, so each one is locked, scored and revealed before the next.

**Locked**:
A question that no longer accepts answers. A block's questions lock together when its break starts; locked is a property of questions, not a status of the game.

**Locking**:
The final countdown on a block's last question; teams can still answer until it runs out and the break starts. Earlier questions in the block stay open until then.
_Avoid_: closing, last call

**Question type**:
What a question asks teams to do (free text, multiple choice, sort, match, closest guess, audio, YouTube), which fixes how its answers are graded and whether it can appear in a kahoot round.
_Avoid_: question kind, question format

**Showdown**:
A tiebreak played between teams tied on the leaderboard, with the teams taking turns in a fixed seat order.
_Avoid_: tiebreaker round, sudden death

**Grading**:
The quiz master marking a team's answer. It can happen as soon as an answer arrives; if the team then revises an answer into something that doesn't match the key, its mark is cleared and must be given again. A typed answer (free text, audio, YouTube) that matches the key is graded correct automatically; only the others wait for the quiz master.
_Avoid_: scoring, marking

**Ungraded**:
An answer still waiting for the quiz master to grade it, and a question with at least one such answer. closest*guess is never ungraded: it is graded in one batch at the lock.
\_Avoid*: unmarked, pending

**Break**:
The pause after a block locks, in which the quiz master finishes any grading still open. The quiz cannot leave the break while an answer is ungraded.

**Break review**:
Stepping back through a block's locked questions during its break, with answers still hidden, e.g. to show a question to the room again.

**Round title card**:
A screen showing a round's name before its content: the round intro before its questions, the break round intro when break review steps across it, and the reveal intro before its answers are revealed.

**Phone screen**:
The screen a team's phone shows, named by the server in the players view as a `phoneScreen` with a kind (`leaderboard`, `block`, `lobby`, `rules`, `round_overview`, `round_title`, `ended`, `showdown_guessing`, `showdown_reveal`). `/play` draws by that kind rather than working it out from the game state. The `block` kind is the block browser, shown while the block is answerable and through break and reveal, and carries the question the big screen is revealing. It does not say which team a phone belongs to: on `showdown_guessing` the phone picks the guess form or the "Tiebreaker in progress" message from its own team id.

## Game status

**Status groups**:
The game is always in exactly one status, but most of the app only needs a yes/no answer to a question about it. Each status group is the fixed answer to one such question, so the phones, the big screen and the backend can never disagree.

One block, in order:

```text
lobby → rules → round_overview
  → round_intro → question_open … → locking        ← answering
  → break_intro (+ break, break_round_intro in break review)  ← in the break
  → reveal_intro → reveal                           ← revealing
  → (next block) … → ended
```

- **answering** — can teams submit or change answers? (question_open, locking, round_intro)
- **question on air** — is a question showing on the big screen? (question_open, locking)
- **break** — is the block in its break? (break_intro, break, break_round_intro)
- **graded** — is grading finished, so scores can be trusted and shown? (the break statuses, reveal_intro, reveal, ended)
- **revealing** — are correct answers being shown? (reveal_intro, reveal)
- **block started** — do the current block's questions exist for teams yet? (answering plus graded)

## Moving through the quiz

**Move plan**:
What one press of an admin action does right now. Advance and Previous: reveal the next leaderboard rank, hide the leaderboard, take a showdown or closest*guess reveal step, move the quiz to its next status, wait for grading (Advance out of the break while an answer is ungraded — pressable, but refused with the ungraded questions), or nothing. Any other action (Start quiz in the lobby, Toggle leaderboard, …) is a plain transition, or blocked when illegal. The Move plan also owns "the next press": Start quiz in the lobby, Advance everywhere else. While the leaderboard is up, a press only works the leaderboard and never moves the quiz underneath.
\_Avoid*: next step, action result

**Settle step**:
Bringing a session's timers, deadlines and reveal counters into line with the point in the quiz it is moving to. Every way a session reaches a new point (starting, restoring after a restart, Advance, Previous) goes through it.

**Commit a move**:
Carrying out one planned press from start to finish: plan it, grade what it implies, settle the session, save its progress. An admin press and both timer expiries go through it. The session only moves once its progress is saved, so a press that can't be saved is refused and nothing changes. Session creation and restart restore reach their starting point through the same module, without a save. The presenter preview is a dry-run commit: the same plan and Settle step, with no grading writes, no showdown resolve and nothing saved, so /remote's "next" line describes the session as the press would leave it.
\_Avoid\*: apply action

**Session write**:
Every change to a live session: one at a time per session, ending with fresh standings. Writes to different sessions run in parallel. A write that fails stores nothing and doesn't block the next one. A write can declare that it doesn't change scores and skip the standings read. Bonus changes go through it today; the other events are moving over.

**Grading refresh**:
The one step every change to grades ends through: given the questions whose grades just changed, it works out which of them are ungraded and fetches fresh standings, and the session takes both in a single update. Today a live answer-key fix ends through it.
