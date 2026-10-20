# Campus Pub Quiz — Domain Language

A live pub quiz: a quiz master runs the game, a big screen shows it, and teams answer on their phones.

## Quiz structure

**Round**:
A titled group of questions in a quiz, shown to teams under one round intro.

**Block**:
A run of consecutive rounds that is graded and revealed together, ending at a round marked to break after it. The last round always ends a block.
_Avoid_: section, segment, grading group

**Block in play**:
The questions of the current block a session has reached. While answering, those up to the furthest opened one (Previous never hides one); once the block locks, the whole block; at `ended`, the last block played, up to where progress stands. Grading, the answering gate and opened questions all cover the block in play. The **Block module** (`shared/types/src/block-in-play.ts`) answers it for any progress; the reveal views are built from its positions.
_Avoid_: current block, active block

**Kahoot round**:
A round where every question is its own block, so each one is locked, scored and revealed before the next.

**Locked**:
A question that no longer accepts answers. A block's questions lock together when its break starts; locked is a property of questions, not a status of the game.

**Locking**:
The final countdown on a block's last question; teams can still answer until it runs out and the break starts. Earlier questions in the block stay open until then.
_Avoid_: closing, last call

**Opened question**:
A question the big screen has shown in a session, remembered for the rest of that session even if Previous steps back before it. It keeps its place in the quiz, its type and its choices. Unopened questions can still be added, moved and deleted while the quiz is running, as long as their block hasn't started locking.
_Avoid_: shown question, locked question (locked means no longer accepting answers)

**Live-edit frontier**:
Where the live sessions on a quiz have got to — their opened questions, the current round of the furthest-on one, and whether that round's block has started locking. The rounds after the current round can be added, deleted and reordered, and their break-after and kahoot setting can change (which moves where the current block ends); the current round and earlier ones keep their place, break-after and kahoot setting. Questions in rounds after the current round can be added, reordered, moved between those rounds and deleted. In the current round the questions after the last opened one can too, until its block starts locking; from then on its rounds are frozen. Rounds before it are always frozen. It is checked and applied while the live sessions are held, so the game can't move past it during a save.

**Question type**:
What a question asks teams to do (free text, number, multiple choice, sort, match, closest guess), which fixes how its answers are graded and whether it can appear in a kahoot round. Media is not a question type.
_Avoid_: question kind, question format

**Media**:
An image, sound or video that any question can carry, shown on the big screen while the question is asked or when its answer is revealed. A video is either a YouTube link or a link to a video file. Which of these it is follows from the link, not from the question type.
_Avoid_: audio question, video question, YouTube question, picture question (no such types)

**Clip**:
The part of a question's video that plays while the question is asked, set by a start and end time.

**Reveal clip**:
The part of a video that plays when a question's answer is revealed: either the question's own video or a separate answer video, each with its own start and end.
_Avoid_: answer clip (could be read as a team's answer)

**Hidden video**:
A video played as sound only, covered on the big screen until the question's answer is revealed.
_Avoid_: audio-only (a question's media can itself be plain sound)

**Answer kind**:
How a question is answered: typed text, a number, picking a choice, putting items in order, or pairing items up. Question type says what a question asks teams to do; answer kind says how they enter the answer, and it is worked out from the type. Branch on this, not on the type, when behaviour differs by how a question is answered.
_Avoid_: input kind (the registry field that is its default)

**Showdown**:
A tiebreak played between teams tied on the leaderboard, in which every tied team guesses at once and the guesses are then revealed one by one in a fixed seat order.
_Avoid_: tiebreaker round, sudden death

**Grading**:
The quiz master marking a team's answer. It can happen as soon as an answer arrives; if the team then revises an answer into something that doesn't match the key, its mark is cleared and must be given again. A free text answer that matches the key is graded correct automatically; only the others wait for the quiz master.
_Avoid_: scoring, marking

**Answer key**:
What an answer is graded against: the correct answer, the points, and the question type's grading settings (a match question's scoring mode, a Number question's margin), with any setting left unset filled in with its default. A key fix is a change to an opened question's answer key.
_Avoid_: grading fields, key fields

**Question record codec**:
The one place a question is converted between its stored row (columns plus a parsed payload), its preview (the shape the quiz editor and import work with), the seeded question a session holds, and the CSV sheet row. One field table decides when each shape carries a field: options, match targets, media, clip bounds, and grading settings (the ones the question type registry lists for the type). Any other field is dropped. The editor asks the same table for the media and clip rule. Unset stays unset; the Answer key owns defaults.
_Avoid_: question mapper, payload mapper

**Grading policy**:
The one rule set for what each grading mode does on each grading event: submit, hand grade, lock, kahoot speed scoring, key fix. It also decides what a client may grade now: it works out each answer's grading state, and the clients are sent the result.
_Avoid_: grading rules, grading service

**Grading state**:
A property of an answer in the admin answer list: `graded` (it has a grade), `ungraded` (no grade yet and the quiz master can grade it now) or `awaiting_batch` (no grade yet; its question's batch grades it when the block locks, so it can't be hand-graded until then). Worked out by the Grading policy; /control renders it and never asks the question type. Not the same as **Ungraded**, but they agree: an `ungraded` answer is one of those, an `awaiting_batch` answer is not.
_Avoid_: grade status

**Verdict**:
How one graded answer was judged: `correct`, `partial` or `incorrect`. It is separate from the points the answer earned, which speed scoring and rounding can scale, so a correct answer can earn less than full points. Teams see their own verdicts on their phones during the reveal.
_Avoid_: result, mark, outcome

**Half points**:
Exactly half a question's points, so half of a 1-point question is 0.5 and half of 3 is 1.5. Points the app works out itself (a part-right match, a kahoot speed score) are kept to the nearest half point.
_Avoid_: partial points (a partial answer can earn any share, not just half)

**Margin**:
How far a Number question's answer may be from the key and still be correct, either as a percentage of the key or as an absolute amount; both ends count. A margin of 0 means only the exact key is correct.
_Avoid_: tolerance, error margin, range

**Accepted range**:
The lowest to highest answer a Number question's margin counts as correct, for the current answer key. With a margin of 0 it is the key alone.
_Avoid_: margin (the margin is the allowed distance; the accepted range is the answers it lets through)

**Ungraded**:
An answer still waiting for the quiz master to grade it, and a question with at least one such answer. closest*guess is never ungraded: it is graded in one batch at the lock.
\_Avoid*: unmarked, pending

**Break**:
The pause after a block locks, in which the quiz master finishes any grading still open. The quiz cannot leave the break while an answer is ungraded.

**Fun fact**:
A line of trivia about the session so far, shown on the big screen during a break. It is drawn only from blocks already revealed, or from figures that give no answer away, so it never hints at the block in play. It appears about a minute into the break, and the quiz master can switch all fun facts off for a session.
_Avoid_: stat, highlight (that's a stats-page tile)

**Break review**:
Stepping back through a block's locked questions during its break, with answers still hidden, e.g. to show a question to the room again.

**Round title card**:
A screen showing a round's name before its content: the round intro before its questions, the break round intro when break review steps across it, and the reveal intro before its answers are revealed.

**Round note**:
What the quiz master says when a round's intro is on air, written on the round. It is always shown on the presenter remote while the round intro (or the break round intro) is on air, and on the big screen too when the round is set to show it; never on the reveal intro, and never on phones. Not the same as a question's notes, which are host-only and never on screen.
_Avoid_: title card note, intro text, round description

**Display screen**:
The screen the big screen draws, named by the server in the display view as `screen` with a kind and the content that kind draws (the question, the round's title, category, author and note, the break number, the leaderboard board and whether it is final, the active showdown). `/display` switches on the kind and looks nothing up. Its kinds are the On-air screen's plus `blank`, which the server sends (and logs) when it can't find a screen's content, so the big screen is never silently empty. Not the same as the On-air screen, which only names the screen (with ids and indexes) for the admin room, the presenter preview and the round note rule.
_Avoid_: display state, big-screen view

**Quiz preview**:
A saved quiz's display screens, stepped through by staff without a session, to check its content before the night. Nothing is played, stored or counted, and no team can join. Not the same as the presenter preview, which describes the next press in a live session.
_Avoid_: rehearsal, test session, dry run

**Phone screen**:
The screen a team's phone shows, named by the server in the players view as a `phoneScreen` with a kind (`leaderboard`, `block`, `lobby`, `rules`, `round_overview`, `round_title`, `ended`, `showdown_guessing`, `showdown_reveal`). `/play` draws by that kind rather than working it out from the game state. The `block` kind is the block browser, shown while the block is answerable and through break and reveal, and carries its mode (`answering` while the block is answerable, `locked` in break and break review, `revealing` from the reveal intro through reveal) and the question the big screen is revealing; the block browser draws from the mode alone. It does not say which team a phone belongs to: on `showdown_guessing` the phone picks the guess form or the "Tiebreaker in progress" message from its own team id.

**Reveal kind**:
How the screens reveal a revealed question: `answer` (the question with its correct answer, laid out by its answer kind), `closest_guess` (the step-by-step closest-guess reveal) or `closest_guess_pending` (display and players views: a `closest_guess` question whose answer step isn't on air yet, so no answer). Decided once by the Screen projection from the question type registry.
_Avoid_: reveal type, reveal mode

**Closest-guess reveal**:
The step-by-step reveal of a closest_guess question: the question; then the smallest guess, the highest guess, the correct answer and the closest teams, one more line per Advance (one step when nobody guessed). Owned by one module and sent to each screen already trimmed to the step on air, so the reveal screen draws what it is sent and never sees a step number.

**Auto-advance**:
A phone setting, on by default and remembered on that phone. On, the block browser follows the big screen's current question and reveal step; off, the team browses the block freely with previous/next.

## Bonuses

**Bonus award**:
Points the quiz master gives a team outside question grading, under one bonus category. The points can be negative, as a penalty. "Bonus points" means the points a bonus award carries.
_Avoid_: bonus (on its own), extra points

**Bonus category**:
What a bonus award was given for: shot, selfie, or custom. A custom award carries a reason the quiz master writes.

## Team link

**Player count**:
How many people a team says are playing in one session: one number per team per session, shared by all the team's phones. The team gives it from its phone and can change it at any time during the session; the quiz master can correct it. It may be unknown, and it is for stats only: the team-size rule in the house rules is not enforced from it.
_Avoid_: team size (that's the cap in the house rules), headcount, members

**Placing**:
Where a team finished in one ended session, with tied teams sharing a place (joint 2nd counts as 2nd). A team that left the session (kicked, or left on its own) has no placing in it.
_Avoid_: position, rank (on its own)

**Average placing**:
The mean of a team's placings across the ended sessions it played, leaving out the sessions it left. A team with no placing has no average placing. The team page averages every night the team has a placing for; the league averages only the nights that count towards the league (the team answered at least one question).
_Avoid_: average position, average rank

**Took part**:
A team took part in a session if it is on the roster, or was kicked or departed and left an answer or bonus award behind. Used by every screen about a session.

**Sessions played**:
The ended sessions a team took part in. Shown the same in the team directory and on the team page.

**Session result**:
What one ended session's results mean, computed by a pure module beside Standings from the session's Standings and its stored questions and answers. Per team: placing, whether it left, totals, whether it answered, its correct count, whether it won the night and whether it is the session winner. Per question: how many teams answered, how many were correct and its correct rate. For the session: the participant count and the max points. It never ranks or re-sums; placing, ties and participation stay with Standings.

**Night won**:
Placing 1st in an ended session. Every team tied for first wins the night, and a team that left never does. The league's nights won and the team page's Wins both count it.
_Avoid_: win (on its own; see **Session winner**)

**Session winner**:
The single team Standings picks as winner of an ended session, by showdown or else name order. It is the trophy row on the stats page. It is not the same as a **night won**: a team tied for first wins the night without being the session winner.

**Correct rate**:
How much of a question the room got right: the summed credit of its answers (a correct answer counts 1, a partial answer its share of the question's points) divided by the participant count. A closest_guess question has no correct rate, since it has one winner by design; it is left out of every rate-based figure.

**Team page**:
A team's own public page at `/team`, opened with its team code instead of a login. It shows the team's history across ended sessions (the same figures staff see on the team stats page, minus anything staff-only), and for each ended session every question with the team's own answer, its verdict and the right answer. It never shows other teams' answers or feedback.
_Avoid_: team profile, team stats page (that is the staff page at `/teams/[id]`)

**Team link**:
A phone's link to its team in a live session: who the team is, whether the server has this connection registered as the team's, and the team's own answers, grades, bonus awards and ratings. It's made by a join, remade after every reconnect and after a session restart, and ended by a kick, the session closing or logging out. A phone is linked only while the server confirms this connection holds the team's seat; until then it offers no answer form, and a rejoin refused because an older socket still holds the seat is retried quietly rather than shown.

**Reconnecting bar**:
The full-width bar fixed to the top of a phone while its connection is down. After 10 seconds it offers "Tap to reconnect", which forces a fresh connection and so remakes the Team link.

## Feedback

**Feedback**:
What a team tells the quiz master about a session from its phone: round ratings, an "anything else" comment and topic suggestions. Always optional, and given by the team, not by individual players. Staff never see which team gave it.
_Avoid_: survey, review

**Round rating**:
A team's score for one round, from 1 to 5 stars in half-star steps (1, 1½ … 5). Asked in the break for the rounds of the block that just locked, and again on the final feedback form, where an earlier rating can be changed. A kahoot round has no break of its own, so it is rated only on the final form.
_Avoid_: round score (that's points)

**Topic suggestion**:
One topic a team would like as a round in a future session, entered as its own short line so suggestions from different teams can be counted together.

## League

**League**:
A named competition, such as a semester's, over which teams are ranked across sessions. A session counts towards a league only once it has been added to that league and has ended.
_Avoid_: season, championship, all teams ever (that's the team directory)

**League points**:
What a team earns towards a league from one session: 5, 4, 3, 2 or 1 for placing 1st to 5th (tied teams each get their shared place's full points) and nothing below 5th, plus one participation point for having answered at least one question. A team that left the session has no placing, so it gets the participation point only. A team that answered nothing earns nothing, whatever its placing.
_Avoid_: season points, ranking points

**League table**:
The teams of a league ranked by league points; teams level on points are split by more nights won (see **Night won**), then by better average placing (compared unrounded), and otherwise share the position.
_Avoid_: league leaderboard, standings (that's one session)

**League top**:
The name and top five rows of the league table of a session's league (the most recently created one if it is in several), shown on the big screen lobby. Sent to the display only, and `null` when the session is in no league.

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
What one press of an admin action does right now. Advance and Previous: reveal the next leaderboard rank, hide the leaderboard, take a showdown or closest*guess reveal step, move the quiz to its next status, wait for grading (Advance out of the break while an answer is ungraded — pressable, but refused with the ungraded questions), or nothing. Any other action (Start quiz in the lobby, Toggle leaderboard, …) is a plain transition, or blocked when illegal. The Move plan also owns "the next press": Start quiz in the lobby, Advance everywhere else. While the leaderboard is up, a press only works the leaderboard; while the join overlay is up, Advance or Previous only hides it. Neither ever moves the quiz underneath. Previous on the rules goes back to the lobby.
\_Avoid*: next step, action result

**Join overlay**:
The join code and QR code shown over the big screen once the quiz has started, so late teams can join without the quiz moving. Like the leaderboard it is not a status: the quiz carries on underneath, timers included, and phones are untouched. Only one of the two is up at a time, and it can't be up in the lobby or once the quiz has ended.
_Avoid_: QR screen, lobby overlay

**Settle step**:
Bringing a session's timers, deadlines and reveal counters into line with the point in the quiz it is moving to. Every way a session reaches a new point (starting, restoring after a restart, Advance, Previous) goes through it.

**Phase timers**:
The two auto-lock timers every live session can have: the question lock (the last question of a block has been open for the lock grace period) and the kahoot question timer (a kahoot question's time ran out). Armed from the session's deadlines, re-armed whenever a write moves one, cleared when it goes away, restored for every session after a restart. An expiry presses Advance exactly as the admin would.

**Session broadcaster**:
Everything the backend pushes to connected clients, through one delivery step for every outcome: the replies to the sender, the room broadcasts, the admin answer lists, the team syncs and any socket closes, in a fixed order, after re-arming the phase timers from the outcome's deadline change. A socket event, a phase-timer expiry, a Live edit save and a REST settings change all end here, so none of them knows about Socket.IO. It also sends the out-of-band notices (a session was closed, a deactivated user's sockets are dropped) and owns the phase timers. The gateway only receives events and hands each outcome over.

**Commit a move**:
Carrying out one planned press from start to finish: plan it, grade what it implies (refused while anything is ungraded when leaving a break for the reveal), settle the session, save its progress. An admin press and both timer expiries go through it. The session only moves once its progress is saved, so a press that can't be saved is refused and nothing changes. Session creation and restart restore reach their starting point through the same module, without a save. The presenter preview is a dry-run commit: the same plan and Settle step, with no grading writes, no showdown resolve and nothing saved, so /remote's "next" line describes the session as the press would leave it.
\_Avoid\*: apply action

**Session write**:
Every change to a live session: one at a time per session, ending with fresh **Live results**. Writes to different sessions run in parallel. A write whose change fails stores nothing and doesn't block the next one. If a final read fails, the change's work is already done (a press has saved its progress), so the write counts as done: the failure is logged, the session is stored with that figure's earlier value and clients are told as usual; the next write reads again. An event is checked against the session as the previous write left it, and stores nothing when refused: its allowed-check, its database writes and its session change all happen inside the write. A write can declare that it doesn't change scores and skip the standings read. The write also reports any change to the auto-lock deadlines (the question lock and the kahoot question deadline) in its outcome, which the delivery step re-arms before any emit. Every event reaches a live session this way; session creation and restart restore place a session through the same last step, so a restored session has its leaderboard in the first snapshot. The Session write module owns the in-memory sessions, so a session is never stored any other way.

**Live results**:
The leaderboard, verdict tallies and fun fact data a live session holds. All are derived from the session's stored answers and bonus awards, and are re-read together after every write that touches scores and when the session is placed (creation, restart). A failed read is logged and that figure keeps its earlier value, which for a fresh or just-restored session is the empty default. The league top is not one of them: a league table counts only ended sessions, so this session's scoring can't change it, and reading it costs a full league table. It is read at placement and on league changes only.
_Avoid_: standings cache

**Prior standings**:
The standings as they stood before the latest scoring the leaderboard should show, which the big screen counts up from between kahoot questions and compares trends against. The Session write keeps them: a write that starts while a question is on air (open or locking) with the leaderboard hidden makes that session's leaderboard the prior standings; any other write carries them over. Grading or a bonus while the question is on air is therefore part of them. The display view's leaderboard description is built from them (its count-up board and kahoot trends), so a reloaded or reconnected big screen draws the same board. Ephemeral like the reveal counters: a restored session after a backend restart has none (empty), and the first board then has no count-up board and its trends fall back to the round backed out.

**Grading refresh**:
The one step every change to grades ends through: given the questions whose grades just changed, it works out which of them are ungraded, and the session takes that in a single update. Standings are left to the Session write.
