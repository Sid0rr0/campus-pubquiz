# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Quiz master / moderator**: a student organiser who runs the night from a laptop on `/control`, under live pressure. They advance the quiz, grade answers as they come in, fix answer keys and award bonuses, all while a room full of people waits.
- **Teams**: groups of students who play on their own phones (`/play`), often on mobile data in a loud, crowded pub. They join by scanning a QR code or typing a code, then answer and revise until the block locks.
- **The room**: everyone watching the projector or TV (`/display`). That screen runs the evening: lobby, rules, questions, countdowns, breaks, reveals and the leaderboard.
- **Admins**: they write quizzes (editor, CSV, Google Sheets), approve staff accounts, and manage sessions, teams and leagues before and after the event.
- **Public visitors**: they check league tables and team pages between quiz nights.

## Product Purpose

Campus Pub Quiz is a modern replacement for paper answer sheets. It runs pub quiz nights for students: semi-automatic scoring, an automatic leaderboard, and features that only work digitally (media questions, live answer-key fixes, showdown tiebreaks, semester leagues). A night is a success when the quiz master spends their time hosting, not tallying, and when teams never lose an answer or their place, even if a phone sleeps or the server restarts.

## Positioning

It keeps the pub quiz format and doesn't try to be a game show. Answers stay open and revisable until a block locks, the moderator grades typed answers, and answers are revealed after each block, with breaks and break reviews in between. A Kahoot-style mode is there for rounds that want per-question reveals, but it's one mode among others, not the core. Paper sheets can't score or rank themselves, and Kahoot can't run a real pub quiz.

## Operating Context

- Organised by ESN CTU in Prague and run by students. Nights recur, and results roll up into semester leagues. The venue time zone is `Europe/Prague`.
- Three screens run at once: the projector in the room, the quiz master's laptop, and every team's phone.
- Internet at the venue is a known risk. Phones use mobile data, and a phone hotspot can carry the two PCs. Reconnecting and resyncing is part of normal use, not an edge case.
- Quizzes are written ahead of time in the in-app editor or a Google Sheet or CSV, then adjusted live when needed.
- Moderators learn to run a night from the in-app `/guide` page.

## Capabilities and Constraints

- Question types: free text, multiple choice, sort/order, match pairs, closest guess, number. Any question can carry an image, audio or a YouTube clip. Kahoot rounds lock, score and reveal each question on its own.
- The server owns all game state; clients render snapshots and send intents. One backend instance, deployed together with Postgres, never on Vercel.
- Team identity lives in localStorage. The recovery path is the team code.
- Domain terms (block, break, break review, joker, showdown…) are defined in `GLOSSARY.md`; UI copy should use them consistently.
- **Future:** other organisers should be able to use it by changing the theme. Visual identity should therefore stay themeable rather than hard-wired to ESN or CTU. How theming works is undecided.

## Brand Commitments

- Product name: **Campus Pub Quiz**. Organiser: ESN CTU in Prague.
- English only.
- No logo yet. No required brand font or colours (the current font, Technika, is a choice, not a requirement).

## Evidence on Hand

- Sound effects in `apps/frontend/public/sounds/` (fanfare, chime, lock countdown, time up; licence in the folder).
- A sample quiz import in `apps/frontend/public/sample-quiz-import.csv`.
- Real league and session data exists in the running app. There are no testimonials, attendance figures or press yet; don't invent them.

## Product Principles

1. **Hosting over admin.** Every control-room feature should save the quiz master attention during a live night.
2. **Never lose a team's work.** Reconnect, resync and safe live edits come before polish.
3. **Pub quiz first, game show second.** Defaults follow the block-lock-reveal rhythm; Kahoot mode is an option, not the template.
4. **Digital where it adds something.** Automate scoring, ranking and media; keep the social, room-centred feel of a paper quiz.
5. **Themeable, not branded-in.** ESN CTU is the first organiser, not the only one.

## Accessibility & Inclusion

- `/display` should be readable from the back of a pub on a projector: large type, strong contrast, nothing that depends on fine detail.
- `/play` has to work one-handed on a phone in a noisy, dim room on a slow connection.
