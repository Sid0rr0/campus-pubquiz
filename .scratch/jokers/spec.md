# Spec: Jokers — each team doubles one round of its choice

Status: ready-for-agent

Blocked by: —

Terms: **Joker**, **Joker round**, **Joker pick** (see `GLOSSARY.md`, "Jokers"). Decision record: `docs/adr/0004-joker-doubling-is-derived-not-stored.md`.

## Problem Statement

Every round counts the same for every team, so a team that knows its strength (music, sport, film) has no way to bet on it. The round overview lists the whole lineup at the start of the night and then nothing comes of it: teams look at it and forget it. The classic pub-quiz joker, "play it on a round and that round scores double", is missing, and with it the moment when a team's bet pays off (or flops) in front of the room.

## Solution

A new session setting, **Jokers**, off by default. When it's on:

- After the big screen shows the round overview, the quiz moves to the **joker pick**: for one minute every team chooses its **joker round** on its phone, while the big screen keeps the rounds listed, counts down to the lock-countdown music and ticks off the teams that have picked. The quiz master can move on early; when the minute runs out the quiz moves on by itself. A team that hasn't chosen gets a random round.
- Each team then carries a joker chip on its phone. While the phone shows a question of the joker round it gets a special border, and the joker round's title card plays a "2× POINTS" animation.
- The team's points from its answers to that round count double. On the first leaderboard after that round's block, the team's row gets a 2× stamp as its rank is revealed, on the big screen and on its phone.
- Picks stay secret from other teams until then. Fun facts in the breaks talk about the jokers: how many teams bet on which round, who drew a random one, and, once revealed, whose joker paid off most and whose backfired.

Turning Jokers on also turns on "Show round overview", which it builds on.

## User Stories

### Setting up

1. As a quiz master, I want a "Jokers" switch in the session settings, so that I choose per night whether teams play jokers.
2. As a quiz master, I want Jokers off by default, so that existing nights run exactly as before.
3. As a quiz master, I want turning Jokers on to turn on "Show round overview" and keep it on while Jokers is on, so that I can't set up a joker pick with no overview before it.
4. As a quiz master, I want the Jokers setting editable only in the lobby, like every other setting, so that the rules can't change mid-quiz.
5. As a developer, I want a stored session whose settings JSON lacks the joker field to read as Jokers off, so that old sessions are unchanged.
6. As a developer, I want the backend to refuse settings with Jokers on and the round overview off, so that the rule holds at the boundary and not only in the UI.
7. As a team, I want the rules screen to tell me about the joker when it's on ("Joker: pick one round to score double. You'll choose after the round overview."), so that I know it's coming.

### The joker pick

8. As a quiz master, I want Advance on the round overview to move to the joker pick when Jokers is on (and straight to the first round intro when off), so that the pick follows the lineup the teams just saw.
9. As someone in the room, I want the big screen during the joker pick to keep every round listed with a 60-second countdown, so that we can discuss the lineup while we pick.
10. As someone in the room, I want the big screen to tick off team names as they pick (without saying which round), and show "N/M picked", so that slow teams feel the pressure without anyone's pick being revealed.
11. As someone in the room, I want the lock-countdown music to play during the joker pick and the time-up sound when it closes, so that the minute feels like a countdown.
12. As a quiz master, I want the existing countdown-sound setting (relabelled "Countdown sound") and the big-screen mute to govern the joker pick's music too, so that one switch controls all countdown audio.
13. As a team, I want my phone to show every round as a large card (number, title, category) with the same countdown as the big screen, so that I can pick quickly.
14. As a team, I want to tap a different round to change my pick until the pick closes, with "Saved ✓" after each tap, so that we can change our minds while we argue.
15. As a team, I want my chosen card to stay highlighted after a reload or reconnect, so that I know my pick was kept.
16. As a quiz master, I want to press Advance before the minute is up to close the pick and move to the first round intro, so that I'm never held hostage by the timer.
17. As a quiz master, I want the pick to close and the quiz to move on by itself when the minute runs out, so that I don't have to watch the clock.
18. As a quiz master, I want the joker pick's deadline to survive a backend restart, so that a redeploy during the pick doesn't leave it open forever or close it early.
19. As a team that hasn't picked when the pick closes, I want a round drawn at random for me and my phone to say "No pick, so we chose Round 4 — Music for you", so that I'm never left without a joker.
20. As a team, I want my phone to show "Your joker: Round 4 — Music" after the pick closes, so that I know where we stand.
21. As a quiz master, I want Previous from the first round intro to go back to the joker pick and reopen it with a fresh minute, so that I can rerun it if the room wasn't ready.
22. As a team that chose a round, I want my choice kept when the pick reopens, so that I don't have to pick again unless I want to.
23. As a team whose joker was drawn at random, I want the draw cleared when the pick reopens, so that I get a real chance to choose and a fresh draw only if I still don't.
24. As a quiz master, I want a reopened pick to offer only rounds with no opened question, so that no team can double a round whose questions it has already seen.
25. As a quiz master, I want Previous from the joker pick to return to the round overview, so that the backward path mirrors the forward one.

### The quiz master's view

26. As a quiz master, I want `/control` to show every team's joker round live, marked as chosen, drawn or set by me, plus "N/M picked" during the pick, so that I can see who's still deciding.
27. As a quiz master, I want to change any team's joker round from `/control` until that round has started, so that I can fix a mis-tap or a team's complaint.
28. As a quiz master, I want my change refused for a round that has already started (has an opened question), so that I can't double a round after its questions were seen.

### Keeping every team with exactly one joker

29. As a team that joins during the joker pick, I want the picker like everyone else, so that I'm not disadvantaged.
30. As a team that joins after the pick closed, I want a random joker drawn from the rounds that haven't started, so that I still have one.
31. As a team that was kicked and rejoins with our name and code, I want our joker back, so that a kick doesn't cost us our bet.
32. As a team whose joker round is deleted by a live edit, I want a new joker drawn from the rounds that haven't started, and to be told, so that I'm not left without one.
33. As a team whose joker round is moved by a live edit, I want my joker to follow the round, so that I keep the round I bet on.
34. As a team, I want a toast whenever my joker changes without me ("…changed by the quiz master", "…drawn for you"), so that I'm never surprised later.
35. As a team reconnecting, I want only the current joker shown (no replayed toasts), so that reconnecting is quiet.

### Playing the joker round

36. As a team, I want a joker chip in my phone's actions bar ("🃏 R4") whenever I have a joker, which I can tap to read "Round 4 — Music scores double", so that I always know which round matters.
37. As a team, I want the chip to show "played" once my joker round's block has been revealed, so that the story closes.
38. As a team, I want my phone to get a joker border whenever it shows a question of my joker round, while answering, locked in the break and during the reveal, so that I know these answers count double.
39. As a team, I want no border on other questions of the same block, so that I don't mistake a normal question for a doubled one.
40. As a team, I want a "2× POINTS" joker card animation when my joker round's intro comes on live, so that the moment feels special.
41. As a team, I want that animation not to replay on a reload, a reconnect or Previous, so that it stays a live moment, the same as the "Locked" stamp.
42. As a team, I want a static joker badge on my joker round's break round intro and reveal intro, so that the round is still marked when its title comes back.
43. As a team, I want picks kept secret from other teams' phones and the big screen until the leaderboard, so that nobody copies or reacts to our bet.

### Scoring

44. As a team, I want our points for each answer in our joker round to count double after grading (a partial 0.5 becomes 1, a 3-point closest guess becomes 6), so that the joker pays off exactly as promised.
45. As a team, I want bonus awards never doubled, so that the joker is about the questions.
46. As a quiz master, I want hand grades, key fixes and joker changes to flow straight into doubled totals, so that I never fix scores by hand.
47. As a quiz master, I want the `/control` round score table to show the doubled points with a joker mark on each team's joker round cell, so that I can explain a total.
48. As a team, I want the leaderboard, placing, showdown ties, nights won, league points and the team page all to use the doubled totals, so that the joker counts everywhere scores count.
49. As someone reading the stats, I want the scoresheet's cells in a team's joker round to show the doubled points with a joker mark, so that each row adds up to the team's total.
50. As someone reading the stats, I want correct rate, question outcomes and the session's max points left as they are, so that question difficulty isn't distorted by bets.
51. As a quiz master, I want the showdown untouched by jokers, so that a tiebreak is a plain guess.

### The leaderboard moment

52. As someone in the room, I want a team's row on the big screen leaderboard to get a "2×" joker stamp, with its gained points visibly doubling, as its rank is revealed on the first leaderboard after its joker round's block, so that the bet lands in front of everyone.
53. As a team, I want the same stamp on our own phone's leaderboard screen, so that we feel it too.
54. As someone in the room, I want the stamp shown even when the team scored nothing in its joker round, so that a flopped joker gets its laugh.
55. As a team whose joker round is a kahoot round, I want the stamp on the leaderboard after each of that round's questions, since each is its own block.
56. As a team, I want the stamp only on the leaderboard for the block holding my joker round, not on later ones, so that it stays a single moment.

### Fun facts

57. As someone in the room, I want break fun facts about the jokers, so that the breaks have joker gossip.
58. As someone in the room, I want to see the most popular joker round and how many teams bet on it, from the first break onward, with no team names, so that it builds suspense without giving any pick away.
59. As someone in the room, I want to hear about a round no team bet on ("Nobody trusted themselves with Round 6 — Sport"), so that we can laugh at it; skipped when every round was picked.
60. As someone in the room, I want to know how many teams ran out of time and got a random joker, so that the slow teams get teased.
61. As a team whose joker earned the most extra points among revealed joker rounds, I want our name up as the best joker ("Quizzly Bears' joker on Music: +14"), so that we get our moment.
62. As someone in the room, I want to see a team whose revealed joker round was its worst round so far, so that a backfire gets its moment too.
63. As a quiz master, I want joker facts that name a team to use only joker rounds already revealed, so that the fun facts never leak a pick before its leaderboard.
64. As a quiz master, I want joker facts only in sessions played with jokers, and switched off with all fun facts by the existing fun-facts switch, so that nothing new needs configuring.

### Preview and guide

65. As a quiz author, I want the Quiz preview to have a "with jokers" switch (off by default) that adds the joker pick to the "like the night" order, so that I can see the screen before the night.
66. As a moderator learning the app, I want `/guide` to explain the Jokers setting, the joker pick, changing a team's joker and the 2× stamp, so that I can run a joker night.

## Implementation Decisions

### Setting

- A new boolean session setting (e.g. `jokersEnabled`), default `false`, on the shared session settings and the partial-settings Zod schema. A stored settings JSON without it reads as off. Lobby-only like every other setting.
- The settings schema refuses `jokersEnabled: true` with `showRoundOverview: false` (including a PATCH that changes only one of the two against the stored other). The `/control` settings panel turns the overview on when Jokers is turned on and disables the overview switch while Jokers is on.
- The existing `playLockCountdownSound` setting keeps its field name; its label and docs become "Countdown sound", covering the lock countdown and the joker pick.

### Status and timer

- New game status `joker_pick`, between `round_overview` and round 0's `round_intro`. It belongs to no status group (it is pre-quiz like `round_overview`). The game-state context gains the joker flag next to `showRoundOverview`.
  - Forward: `round_overview` → `joker_pick` when Jokers is on, else → `round_intro` as today. `joker_pick` → round 0's `round_intro`.
  - Backward: round 0's `round_intro` → `joker_pick` when Jokers is on; `joker_pick` → `round_overview`.
- Entering `joker_pick` (forward or backward) opens the pick and arms a **joker pick deadline** 60 s out (a fixed constant). Leaving it by any route closes the pick: the deadline is cleared, drawn jokers are assigned, and the close is reported to phones.
- The joker pick deadline joins the **Phase timers** (a third timer beside the question lock and the kahoot question timer): set in the **Settle step**, armed and re-armed by the **Session broadcaster**, restored after a restart, and its expiry presses Advance through **Commit a move** exactly as the admin would. The glossary's "Phase timers" entry is updated from "two" to three.
- Re-entering `joker_pick` with Previous clears every drawn joker (chosen and quiz-master-set jokers stay) and opens the pick with a fresh deadline.

### Data model

- A new table, one row per team per session, kept apart from the roster row (which a kick deletes) so a joker survives a kick and rejoin, modelled on the session player counts: session, team, round, and a **source** (`chosen` | `drawn` | `set_by_quiz_master`). Unique on (session, team). A migration adds it.
- A team's joker references the round, so it follows the round through reorders. Deleting a round through a live edit redraws every joker on it, inside the same live-edit save.
- Answers' stored points are never doubled (ADR 0004).

### Joker module (shared types, pure)

A pure module that owns the joker rules, used by the backend and by test fixtures:

- `pickableRounds(quiz structure, opened questions)` → the rounds with no opened question.
- `drawJoker(pickable rounds, random source)` → one round with equal chance; the random source is injected so tests are deterministic.
- `canChooseJoker(status, round, …)` → a team may choose only while `joker_pick` is on air and only a pickable round.
- `canSetJoker(round, …)` (quiz master) → any time after the pick has opened, only a pickable round.
- The doubling step: given a team's joker round and per-round points, returns the totals with the joker round counted twice. Every place that sums points goes through it (see below).

### Protocol

- Client → server:
  - `PICK_JOKER` (team): `{ roundId }`. Refused outside `joker_pick` or for a round that isn't pickable. Last write wins.
  - `SET_TEAM_JOKER` (admin): `{ teamId, roundId }`. Refused for a round that isn't pickable or a team not in the session.
  - Both are **Session writes** that touch scores (a joker change moves standings).
- Server → client:
  - The players view carries the team's own joker (`{ roundId, source, played }` or `null`) and, on `joker_pick`, the pick's deadline and the pickable rounds. It never carries another team's joker.
  - A team sync event pushes the team's joker when it changes without that team's own pick (quiz master, draw, redraw). The phone shows the toast only for a live sync, never on a state sync or reconnect.
  - The display view, on `joker_pick`, carries the deadline, the round list and the ids of teams that have picked. It never carries which round a team picked.
  - The admin view carries every team's joker with its source.
  - The leaderboard's description (built from the **Prior standings**) carries, per row, whether the team's joker round is in the block just scored, so the big screen and the phone both draw the 2× stamp from the server's answer.
- **Phone screen** gains a `joker_pick` kind: the picker while the pick is open; the "Your joker" result plus "Look at the screen" after it closes, when Previous parks the screen on `joker_pick` through a closed state the server describes. The **Display screen** gains a `joker_pick` kind too.

### Scoring and read models

- One shared step applies the joker wherever answer points are summed. Standings (total, quiz points, round points), the round score table on `/control`, the **Scoresheet**, the **Session result**, the team page and the league table all read the team's joker round and double that round's answer points. Bonus awards are never doubled.
- Correct rate, the **Question outcome**, the existing fun facts and the session's max points read raw answer points as today.
- Ties and showdowns are decided on the doubled totals; the showdown guess itself is not a round and never doubled.
- The scoresheet cell and the `/control` round cell of a team's joker round carry a joker flag for the mark.

### Leaderboard stamp

- A row's stamp is on when the team's joker round has a question in the block just scored, i.e. the block the current Prior standings were taken for. In a kahoot round that is each question. It shows on 0 points too.
- The big screen plays it when that row's rank is revealed (the stamp lands and the gained points visibly double). The phone's leaderboard screen shows it on the team's own row. Neither replays it on reload.

### Phone

- The actions bar gains a joker chip whenever the team has a joker; tapping it explains the round. It reads "played" once the joker round's block has been revealed.
- The block browser draws the joker border for a question of the joker round in every mode (`answering`, `locked`, `revealing`), never for other rounds' questions in the same block.
- The joker round's `round_intro` plays the "2× POINTS" card animation on live moves only, through the same live-change helper as the "Locked" stamp. Its `break_round_intro` and `reveal_intro` show a static badge.

### Big screen

- The `joker_pick` screen lists every round (number, title, category, author, like the overview), a 60 s countdown to the server deadline, "N/M picked", and the team names that have picked.
- Sound: `soundFor` plays the lock-countdown track from the moment the screen enters `joker_pick` live (it runs 60 s, so it ends as the pick closes) and stops it on leaving early; `time-up` plays once on leaving `joker_pick` forward. Both follow the countdown-sound setting and the big-screen mute; the countdown track keeps playing under an overlay like the lock countdown.

### Fun facts

New kinds in `describeFunFacts`, placed after the existing facts and before `bonus_awards_so_far`, only when the session plays with jokers:

| `kind`                  | Meaning                                                                                       | Names a team? |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| `joker_favourite_round` | The round the most teams have as their joker, and how many                                    | No            |
| `joker_snubbed_round`   | A round no team has as its joker; skipped when every round is someone's joker                 | No            |
| `joker_drawn_count`     | How many teams got a drawn joker; skipped at 0                                                | No            |
| `best_joker`            | Among revealed joker rounds, the team whose joker earned the most extra points, and the extra | Yes           |
| `joker_backfired`       | Among revealed joker rounds, a team whose joker round was its lowest-scoring round so far     | Yes           |

Facts that name a team read only joker rounds whose blocks are revealed. Ties go to leaderboard name order, as today. The fun fact data gains the session's jokers.

### Quiz preview

- A "with jokers" switch, off by default. On, the "like the night" order includes `joker_pick` after the overview, with no teams ("0/0 picked") and no timer running out.

### Docs

- `DOCUMENTATION.md`: the status table and diagram (`joker_pick`), the settings, the phone and display screen kinds, the new socket events and view fields, the sound table, the fun facts table, standings doubling.
- `GLOSSARY.md`: "Phase timers" (three timers), the status-group diagram.
- `/guide`: the Jokers setting, running the joker pick, changing a team's joker, the 2× stamp.

## Testing Decisions

A good test drives the feature from outside, through the events, views and screens a client sees, and asserts what a client would see. It never asserts on internal calls, private state or which module did the work.

- **Joker module (pure, shared types):** pickable rounds exclude rounds with an opened question; a draw only returns a pickable round (with an injected random source); the choose/set gates by status and round; the doubling step doubles only the joker round and never bonus points.
- **Game-state transitions (pure, shared types):** forward and backward through `round_overview ⇄ joker_pick ⇄ round_intro` with Jokers on, and the unchanged path with it off. Prior art: the existing game-state and backward-transition specs.
- **Real-store gateway harness (backend, the main seam):** prior art `join-overlay.spec.ts`, `kahoot-question-timer.spec.ts`, `award-bonus.spec.ts`, `fun-facts.spec.ts`, `collect-feedback-setting.spec.ts`.
  - The setting: default off, refused with the overview off, lobby-only, stored JSON without it reads as off.
  - The pick: entering arms the deadline; `PICK_JOKER` accepted during the pick and last write wins; refused outside it and for a started round; expiry presses Advance; Advance early closes it; drawn jokers on close; the deadline survives `restart()`.
  - Reopen: Previous re-enters with a fresh deadline, drawn jokers cleared, chosen and quiz-master-set jokers kept, started rounds not offered.
  - One joker per team: late join during and after the pick; kick and rejoin keeps it; deleting the joker round via a live edit redraws it; reorder keeps it; `SET_TEAM_JOKER` accepted and refused cases.
  - Views and secrecy: the players view has only the team's own joker; the display view never has a round per team; the admin view has all with sources; a reconnecting phone gets its joker in the state sync without a toast event.
  - Leaderboard stamp: on for the block holding the joker round only, per question in a kahoot round, on 0 points.
  - Fun facts: each joker fact, counts from the first break, team-naming facts only from revealed joker rounds, none when Jokers is off.
- **Standings over real Postgres:** prior art `standings.service.spec.ts`, `session-result.spec.ts`, the league table specs. Doubled totals and round points, bonus not doubled, partial and closest-guess points doubled, a joker change and a hand grade both move totals, stored answer points unchanged, scoresheet cells and league points from doubled totals, correct rate and max points unchanged.
- **Frontend page tests, views from the `roomView` fixture builder:** the phone picker (cards, countdown, "Saved ✓", result after close, "drawn for you"), the joker chip and "played", the border on joker-round questions only, the intro animation on live moves only and the static badges, the change toast on a live sync only; the display `joker_pick` screen and the 2× stamp on rank reveal; `soundFor` for the countdown and time-up; the `/control` settings coupling, joker list with sources and the override; the Quiz preview switch; the `/guide` text.
- **One Playwright journey (`e2e/`, local only):** a joker night with two teams, one picks and one is drawn, a block is revealed and the 2× stamp shows. Prior art `bonus-award.spec.ts`, `kahoot-round.spec.ts`.

## Out of Scope

- CSV import/export changes: jokers belong to a session, not a quiz.
- A per-round "no joker" flag in the quiz editor.
- A configurable pick length (fixed at 60 s).
- More than one joker per team, or other multipliers (triple, halve).
- Doubling bonus awards.
- Making the session's max points or correct rate joker-aware.
- Showing other teams' jokers anywhere before the leaderboard stamp.

## Further Notes

- Build order suggestion: setting + status + timer + data model and the pick over the harness first, then scoring through the shared doubling step (the riskiest part, since every total must agree), then phones and big screen, then the stamp, sound and fun facts, then preview, guide and e2e.
- The doubling step is the single place joker scoring lives. A new read model that sums answer points must go through it, or its numbers will disagree with the leaderboard (ADR 0004).
