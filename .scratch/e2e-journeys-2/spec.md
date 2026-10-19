# Spec: E2E coverage of a whole quiz night

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-10-19 ("add more e2e tests").

## Problem Statement

Before a quiz night, or after a big change, the only way to know every screen still shows what it should is to run a night by hand: two phones, the big screen and the laptop, clicking through every status. The five journeys from [`e2e-tests`](../e2e-tests/spec.md) cover the wiring (happy path, phone reconnect, kick and recovery code, backend restart, login and import). They don't cover:

- most of what was built since: kahoot rounds, showdown, bonus awards, live answer-key fixes, feedback, round notes, title cards, fun facts, video and YouTube media, `/remote`, the moderator role;
- question types other than `free_text` and `multiple_choice` on a real touch phone;
- **things going missing.** The happy path asserts a handful of values (the prompt, an answered count). It would not notice the round title, the question number, the join code or the break timer vanishing from a screen.

## Solution

Extend the `e2e/` workspace so that a full run replaces the manual run-through:

1. **A coverage registry.** Every status × screen cell, and every move and overlay, is listed in `e2e/support/`. A full run fails if any of them was never visited by a test.
2. **Whole-screen assertions.** At each cell, a Playwright ARIA snapshot captures the screen's accessible structure, so a missing element fails the test. Hand assertions keep checking the values that must be *right* (points, standings, answers).
3. **A full-night journey** over a CSV holding every question type, a kahoot round, a break with round notes and fun facts, and every kind of media: the manual run-through, automated.
4. **Focused journeys**, one per feature, each on its own small CSV.

Harness decisions (ports, database, production builds, login budget, `retries: 0`, one session per test) are unchanged from the [`e2e-tests` spec](../e2e-tests/spec.md); this spec doesn't restate them.

## User Stories

1. As a developer, I want `pnpm e2e` to tell me if any screen in any status has lost something it used to show, so that I don't have to click through a night by hand.
2. As a developer, I want a full run to fail when a status, screen or move has no test, so that a gap in coverage is visible rather than silent.
3. As a developer, I want a snapshot failure to show me what changed in the screen's structure, and `--update-snapshots` to accept an intended change.
4. As a quiz master, I want a whole night (rules, round overview, round title cards with notes, every question type, a kahoot round, locking, break with fun facts and break review, grading, reveal, leaderboard, ended) to work across all three screens.
5. As a quiz master, I want kahoot rounds, showdowns, bonus awards, live answer-key fixes, feedback, media controls and `/remote` to each have a journey.
6. As a team, I want `sort`, `match`, `number` and `closest_guess` answers entered on a touch phone to be sent and shown at reveal.
7. As an admin, I want a moderator I create to log in and run `/control`.
8. As a quiz author, I want a quiz built in the editor to be playable, and an exported CSV to re-import unchanged.
9. As a developer, I want the whole suite to finish in under five minutes with `E2E_SKIP_BUILD=1`.

## Implementation Decisions

- **What "complete" means.** The status table in `DOCUMENTATION.md` (`lobby`, `rules`, `round_overview`, `round_intro`, `question_open`, `locking`, `break_intro`, `break`, `break_round_intro`, `reveal_intro`, `reveal`, `ended`) is the checklist for the big screen and the phones. It has no `/control` column; `/control` cells are checked against what the `/guide` page says the moderator sees.
- **Moves and overlays** tracked alongside the cells, taken from `DOCUMENTATION.md`: `PREVIOUS` through break review and back across a block boundary; the leaderboard toggle and its slot-by-slot reveal; the join overlay; the `closest_guess` step-by-step reveal; showdown turns; auto-advance; phase timers; media pause, replay and fullscreen; `END_QUIZ`.
- **Registry and reporter.** `e2e/support/coverage.ts` lists every cell (`status × screen`) and move. The snapshot helper takes the cell it covers (e.g. `await snap(display, 'break_intro')`), and the move helpers record their move. A custom Playwright reporter collects what was visited and fails the run when anything is missing. It only checks on a full run: a run filtered by file, `--project`, `--grep` or `--repeat-each` skips the check. `E2E_COVERAGE=off` turns it off while the journeys are still being written; ticket 15 makes the check on by default. Adding a status to the doc without adding it to the registry is caught in review; adding it to the registry without a test turns the suite red.
- **Snapshots.** `toMatchAriaSnapshot` with snapshot files (not inline), one per cell per journey. Team names, join codes, recovery codes, timers and session-specific numbers are matched with regexes. Hand assertions stay for points, standings, grades and submitted answers. No screenshot or pixel diffing.
- **Semantic markup.** A screen that snapshots as a flat run of text gets headings, `aria-label`s or labelled regions in the frontend. Changes are semantic only: no visual change, no new `data-testid`. The existing Vitest specs must still pass.
- **Boundary: wiring, not game logic.** For `sort`, `match`, `number` and `closest_guess`, a journey checks only that a phone can enter the answer, that `/control` sees it, and that the reveal shows it. Partial credit, margins and closest-team rules stay with the real-store specs.
- **Media without the network.** `page.route` serves small committed fixture files (an mp3, an mp4, a png) for `https://example.invalid/...` URLs and answers `youtube.com/embed/*` with a blank stub page. Tests assert the right player and `src` on `/display` and that pause, replay and fullscreen change its state. Whether a YouTube clip really starts at `start` is the player's job and isn't tested.
- **Fixtures.** One full-night CSV (`e2e/fixtures/full-night.csv`) with two blocks, every question type, a kahoot round, a `round_note` (one shown on screen), round categories and authors, a bonus category, a fun fact, and media of each kind. Focused journeys get their own small CSVs, holding only what they need.
- **Pages beyond the game screens.** `/remote`, the quiz editor (one create-and-play journey), CSV export and re-import, and the users page (create a moderator). `/stats`, `/teams` and `/sessions` get a smoke check that each renders with data after a played session. `/register` is out.
- **When a test and the doc disagree.** If the doc is stale, fix the doc in the same commit. If the code looks wrong, don't fix it in the E2E ticket: file a `needs-triage` bug under `.scratch/`, mark the assertion `test.fail()` with a comment linking to it, and carry on. E2E tickets never change game behaviour.
- **Timers.** Lock grace, phase timers and auto-advance are set to 1 second in E2E sessions; never wait several seconds. Clocks are never faked.
- **Time budget.** A full `E2E_SKIP_BUILD=1 pnpm e2e` stays under five minutes with the default workers.
- **Logins.** The moderator, editor and UI-login journeys log in through the existing login budget (`e2e/support/login-budget.ts`).

## Testing Decisions

- Assert what the people in the room see, never socket payloads or database rows (unchanged).
- Each journey file must pass `--repeat-each=5` before its ticket is done (unchanged).
- A snapshot that captures a session-specific value (a team name, code or timer) without a regex is a bug: it will fail on the next run.

## Out of Scope

- CI, `pnpm test` and the pre-commit hook: the suite stays local-only.
- Screenshot or pixel diffing.
- WebKit and Firefox.
- Grading rules beyond "the reveal shows it".
- Real YouTube or real media hosts.
- `/register`.
- Load testing.
