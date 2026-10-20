# Spec: The big screen and the phones draw what they are sent

Status: ready-for-agent

Source: architecture review 2026-10-20, candidate 3 ("Worth exploring", in-process).

Reopens one decision of `display-screen-kind` (done): its Out of Scope rejected adding question or round content to the On-air screen, because "widening the shared type would also widen the admin and players views". That reason no longer fully applies:

- phones now get their own Phone screen and never receive the On-air screen;
- this spec leaves the On-air screen as it is and gives the content only to the display view.

## Problem Statement

The Screen projection names the screen on air, but it doesn't send what that screen draws. Each page joins the pieces itself.

**The big screen (`/display`):**

- It is sent the On-air screen as a kind plus ids and indexes. It then:
  - looks up the question in the block questions or the reveal questions by id;
  - guards each of six screens with "draw nothing if the lookup missed";
  - works out the rest from game progress: the "ROUND N" label of a round title card, the break number, whether this is the last break (which hides the bonus list and crowns the winners), and whether the leaderboard on air is the final one.
- The rules for "which round is this card about" and "is this the final board" therefore live in the page, where only page render tests reach them.
- A lookup that misses (a reveal question not in the list, a break question that moved) leaves the big screen blank in front of the room, with nothing logged and no test covering it.

**The phones (`/play`):**

- **The block browser decides its own mode.** It is told only that it is the `block` Phone screen. It then branches on game status to choose:
  - showing the revealed answer or the question;
  - "Answering is locked for this question" in a break;
  - "Revealing answers…" in reveal.
  A change to what a phone shows in break or reveal means finding those status checks.
- **A correct kahoot answer is shown as wrong.**
  - In reveal, the block browser colours "Your answer" green only when the team's points equal the question's points.
  - In a kahoot round, speed scoring scales a correct answer's points down. A team that answered correctly but not first sees its answer in magenta, the wrong colour, while the verdict card a moment earlier said "Correct".
  - A partial answer is also shown in the wrong colour.
- **Phones are sent fields they never read.** Every room's view starts from one shared snapshot, so every phone is sent:
  - the big screen's text scale and sound mute;
  - the break end time;
  - which teams have answered the current question;
  - every round title;
  - the closest-guess reveal step, which no page reads at all.
  This breaks the coding standard that a field only one room reads goes in that room's view, and it puts more on the wire to every phone on every broadcast.

## Solution

**The display view carries a Display screen.** Every kind carries the content it draws:

- the question for a question, break review or reveal screen;
- the round number, title, category, author and note for a round title card;
- the break number and whether it is the final break, for the break intro;
- whether the board is final, for the leaderboard.

`/display` switches on the kind and draws, with no lookups and no game status checks. When the projection can't resolve a screen's content, it sends one explicit `blank` screen and logs it, instead of six silent guards in the page. The On-air screen keeps its current shape, so the admin room and the presenter preview don't change.

**The block Phone screen carries its mode:** `answering`, `locked` or `revealing`. `/play` draws the block browser from the mode and never from game status.

**The block browser colours "Your answer" by the team's Verdict:**

- green for `correct`;
- its partial colour for `partial`;
- magenta for `incorrect` or no answer.

This matches the verdict card. A speed-scaled correct kahoot answer is green.

**Each room's view carries only what that room reads.** The fields only the big screen and `/control` read move out of the shared snapshot into the display and admin views, and the closest-guess reveal step leaves every view. Phones stop receiving them.

What changes for users:

- A team that answers a kahoot question correctly but not first sees its answer in green on the reveal.
- A partial answer is shown as partial.
- Everything else on the big screen and the phones looks and behaves as today.

## User Stories

1. As a team in a kahoot round, I want my correct answer shown in green on the reveal even when speed scoring gave me fewer than full points, so that the phone doesn't tell me I was wrong.
2. As a team, I want a partly right answer shown as partly right on the reveal, so that it matches the verdict card I just saw.
3. As a team, I want an incorrect answer and no answer shown as today, so that nothing changes for those.
4. As a team, I want my block browser to show the question and the answer form while the block is answering, as today.
5. As a team, I want "Answering is locked for this question" during a break, as today.
6. As a team, I want the revealed answer and my own answer in reveal, and "Revealing answers…" for a question the big screen hasn't reached, as today.
7. As a team with auto-advance on, I want my phone to keep following the question the big screen is revealing, as today.
8. As a team on a slow mobile connection, I want my phone sent only what it draws, so that each update is smaller.
9. As a quiz master, I want the big screen to show the same screens with the same content as today, so that a quiz night looks the same.
10. As a quiz master, I want a round title card to read "ROUND N — category" with its title, author and note as today, wherever the card appears (round intro, break round intro, reveal intro).
11. As a quiz master, I want the break intro to show the right break number and to hide the bonus list on the last break, as today.
12. As a quiz master, I want the leaderboard to crown the winners only when it is the final board, as today.
13. As a quiz master, I want the break review screen to show the question I stepped back to, as today.
14. As a quiz master, I want a reveal screen to show the revealed question, with a closest guess walked one step at a time, as today.
15. As a quiz master, I want the big screen never to go silently blank, so that if a screen's content can't be found it is logged and can be fixed.
16. As a quiz master, I want the presenter remote's "now showing / next" preview unchanged, since it reads the On-air screen.
17. As a quiz master, I want the big screen's text scale, sound mute and break end time to keep working from `/control`, so that moving those fields out of the phones' view changes nothing for me.
18. As a quiz master, I want the answered count on the big screen and on `/control` to keep updating live, as today.
19. As a quiz master, I want a reloaded or reconnected big screen to draw the same screen, as today.
20. As a developer changing what a big screen screen shows, I want to change the projection and test it as data, so that I don't need a rendered page to check the rule.
21. As a developer, I want `/display` to be a switch over the Display screen, so that adding a screen kind is one projection case and one render case.
22. As a developer, I want the block browser to draw from its mode, so that a change to what a phone shows in break or reveal is one projection change.
23. As a developer, I want each room's view to carry only what that room reads, so that the type tells me what a page can use.
24. As a developer, I want the "which round is this card about" rule written once in the projection, not again in the page.
25. As a developer, I want the closest-guess reveal step kept server-side, since the reveal questions are already trimmed to it.

## Implementation Decisions

### The Display screen

- **New wire type.** The Screen projection's display view gains the **Display screen**: a union with the same kinds as the On-air screen plus `blank`. It replaces the On-air screen in the display view. The display view keeps `screenKey` and the header as they are.
- **What each kind carries.** It is derived from the On-air screen the projection already computes, adding the content each kind draws. No page looks anything up.
  - `lobby`, `rules`, `round_overview`, `join_overlay`: nothing beyond today's display view fields (teams, settings, league top, round overview lists).
  - `round_title`: round number, title, category, author and round note as the card shows them.
  - `question`: the open question.
  - `locking`: the lock deadline.
  - `break_intro`: round number, break number, whether it is the final break, the feedback prompt flag, the fun facts and the break end time.
  - `break_review`: the block question under review.
  - `break_round_title`: round number, title and round note of the round being stepped across.
  - `reveal_intro`: round number and title of the round about to be revealed.
  - `reveal`: the reveal question, trimmed to its closest-guess step as today.
  - `leaderboard`: the leaderboard board, its reveal count, and whether it is the final board (the quiz has ended, or this is the last break).
  - `ended`: the feedback prompt flag.
  - `showdown`: the active showdown view and its reveal step.
  - `blank`: nothing. Sent only when the projection can't resolve a kind's content; the projection logs it.
- **No duplicate copies.** Fields that move into a Display screen kind (fun facts, leaderboard board, the round being shown, the break end time) are not also sent at the top of the display view. Fields more than one screen draws stay at the top: teams, settings, quiz structure, text scale.
- **The On-air screen is unchanged.** The admin room keeps receiving it, the presenter preview keeps building its text from it, and the round note rule keeps reading it.
- **`/display` becomes a switch** over the Display screen. The page's own lookup by id, its "draw nothing" guards, and its own break number, last-break and final-board rules are deleted. Sounds and the round title sting keep their current triggers; moving them onto the Display screen is out of scope.

### The block Phone screen

- **New mode field:**
  - `answering` while the block is answerable;
  - `locked` in break and break review (the block is locked, nothing is revealed);
  - `revealing` from the reveal intro through reveal.
  It keeps the question the big screen is revealing.
- **`/play` draws from it.** The block browser chooses the reveal body, the answer form, and the locked and revealing lines from the mode. It no longer checks game status, the break status group or the revealing status group.
- **"Your answer" colour.** It comes from the team's Verdict for that question: the team's own answer grades, which `/play` already holds and the verdict card already reads. Points stay as the "n / max points" line. The colours are the ones the verdict card uses for each Verdict.

### Room views

- **The shared snapshot keeps only fields every room reads.** These move into the display and admin views:
  - the big screen's text scale and sound mute;
  - the break end time;
  - the answered team ids;
  - the round titles.
  (`/remote` reads through the admin view.)
- **The closest-guess reveal step leaves every room view.** The reveal questions are already trimmed to it on the server.
- **The fixtures follow.** The shared room-view fixtures used by the frontend page tests are built by the projection, so they change with it.

### Docs, in the same change

- **GLOSSARY.md** gains **Display screen**: the screen the big screen draws, named by the server in the display view with the content it draws; `blank` when its content can't be found. Not the same as the On-air screen, which names the screen for the admin room and the presenter preview.
- **GLOSSARY.md, Phone screen:** the entry says the `block` kind carries its mode (`answering`, `locked`, `revealing`).
- **DOCUMENTATION.md:**
  - the protocol section lists the Display screen in the display view and the block mode in the players view;
  - fields that left the players view are no longer listed there;
  - the phone reveal paragraph says "Your answer" is coloured by its Verdict.

## Testing Decisions

- **What makes a good test:** it builds a session, projects it for a room, and checks the view that comes out, or renders a page from a projected view and checks what is on screen. It never asserts on how the projection got there.
- **The Screen projection** is the main seam, tested as data with its existing spec style. Cases:
  - one per Display screen kind, checking the content it carries;
  - a round title card in each of its three places names the right round (round intro, break round intro across a round, reveal intro);
  - the break number and final-break flag on the first and last break;
  - the final board after `ended` and in the last break, and not in an earlier break;
  - `blank` when a reveal or break review question can't be found;
  - the block mode in answering, break, break review, reveal intro and reveal;
  - the players view carries none of the moved fields, and no view carries the closest-guess reveal step.
- **`/display` page tests** become "renders kind X from a projected view". Tests that built a whole snapshot to check a lookup or a derived label move to the projection spec.
- **`/play` tests:**
  - the block browser draws each mode;
  - a speed-scaled correct kahoot answer is green;
  - a partial answer is shown as partial.
  They use the projected fixtures, as today.
- **Prior art:**
  - the Screen projection spec and the Phone screen cases from `players-reveal-redaction`;
  - the shared room-view fixtures from `room-view-projection`;
  - the existing `/display` and question browser render tests.
- **E2E:** run `pnpm e2e` once before the PR. The full-night, kahoot round, showdown and media journeys cross every Display screen kind and the block browser modes. No new journey is needed, but if the kahoot journey checks the reveal colour, it must follow the new rule.

## Out of Scope

- Changing the On-air screen, the admin view's screen fields or the presenter preview.
- Moving the big screen's sounds and the round title sting onto the Display screen. They keep their status-based triggers.
- The showdown reveal on the phone and big screen. The server already sends it trimmed to the step on air; only the spotlight reads the step number.
- Any change to which screen shows in any status, or to any screen's layout, wording or animation (apart from the reveal colour fix).
- Per-team views. The players view stays one broadcast, and anything keyed by the phone's own team (its verdicts, its turn in a showdown) stays on the phone.
- Trimming the admin view.

## Further Notes

- Decisions confirmed with the user on 2026-10-20:
  - content goes in a display-only Display screen, and the On-air screen stays lean (this answers `display-screen-kind`'s reason for rejecting the change);
  - the phone side includes the block mode, the Verdict colour fix and trimming the players view.
- The three parts are independent and can ship separately. The Verdict colour fix is the only one users will notice, and it is the smallest.
