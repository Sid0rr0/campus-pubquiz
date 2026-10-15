# Spec: Browser end-to-end tests for a quiz night

Status: done

Blocked by: none

Source: grilling session 2026-10-14 ("add e2e tests").

## Problem Statement

Nothing drives the three UIs together in a real browser. The backend's real-store specs run the game over Postgres, but through a mock socket server. The frontend's Vitest specs render pages in happy-dom against a fake socket. So no test catches a break in the wiring between them:

- `/control`, `/display` and `/play` talking over a real Socket.IO connection to one backend;
- a phone reloading mid-block and getting its team, answers and question back;
- a backend redeploy (about ten seconds of frozen sockets) and every client resyncing afterwards. CLAUDE.md calls this path one that "must be built and tested early".

Those are the failures that show up live on stage.

## Solution

A new top-level `e2e/` pnpm workspace runs Playwright against **production builds** of both apps, over a throwaway Postgres database. Run it locally with `pnpm e2e`. It isn't part of CI, `pnpm test` or the pre-commit hook.

Each test opens one browser context per role: the quiz master's laptop on `/control`, the big screen on `/display`, and one or more mobile-emulated phones on `/play`. Each context has its own `localStorage`, as a real device would.

## User Stories

1. As a developer, I want `pnpm e2e` to build both apps, start them on their own ports against their own database, and run every journey, so that I can check a quiz night end to end before I merge.
2. As a developer whose dev servers are running on :8888/:3000, I want E2E to leave them, their `.next` folder and the `campus_pubquiz` database alone.
3. As a developer, I want each test to run its own quiz session with its own teams, so that tests run in parallel without seeing each other.
4. As a developer, I want a failed test to leave a trace, a screenshot and a video, and nothing to be retried, so that a flaky test fails loudly.
5. As a quiz master, I want a full block (questions, answers that teams revise, locking, break, grading, reveal, standings) to work across all three screens.
6. As a team, I want a reloaded phone to come back with my team, my answers and the current question.
7. As a quiz master, I want a kicked team's phone to be told it was removed and to need its recovery code to rejoin, and I want a teammate's second phone to join with the recovery code.
8. As a quiz master, I want a backend restart mid-block to leave every screen resynced, with nothing lost.

## Implementation Decisions

- **Tool:** Playwright, Chromium only. Phones are mobile-emulated contexts (a phone viewport, touch, a mobile user agent). WebKit can be added later as its own project if a Safari-only bug turns up.
- **Workspace:** top-level `e2e/` in `pnpm-workspace.yaml`, with its own `package.json` (`@playwright/test` lives here, not in the frontend). Commit scope `e2e`. The root `package.json` gets `"e2e": "pnpm --filter e2e test"`. The workspace's `test` script must not be picked up by `pnpm -r test`: name it `e2e`, not `test`, or exclude the workspace from the recursive run.
- **What runs:** production builds. The frontend runs `next start` on **:8889**, built into **`.next-e2e`** with `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`. `next.config.ts` reads `distDir` from an env var and falls back to the default when it's unset, so dev and prod builds don't change. The backend runs `node dist/main` on **:3001** with `FRONTEND_ORIGIN=http://localhost:8889`, `BOOTSTRAP_ADMIN_*` set, and `DATABASE_URL` pointing at `campus_pubquiz_e2e`.
- **Database:** `campus_pubquiz_e2e` in the docker-compose Postgres. A global setup drops it, creates it again and applies the migrations before the backend starts. If Postgres isn't running, the run fails with a clear message.
- **Starting the backend:** our own helper, not Playwright's `webServer`. It spawns `node dist/main`, waits until it answers, and exposes stop and start, so the restart journey can kill it and bring it back. The frontend can use `webServer`.
- **Login:** the admin logs in once in global setup through `POST /auth/login`, and the result is saved as Playwright `storageState`. Login is limited to 5 attempts per minute (`ThrottlerGuard`), so tests must not log in one by one. One test logs in through the UI.
- **Seeding:** through the real HTTP endpoints. Import the CSV fixture (`/import/preview`, then `/import/confirm`), create a session (`POST /sessions`), and set its settings (`PATCH /sessions/:joinCode/settings`). State-changing calls need the `x-requested-with: XMLHttpRequest` header (`session.guard.ts`). Nothing writes straight to the database.
- **Isolation:** each test creates its own session and unique team names, and tests run across parallel workers. The backend already runs several sessions at once.
- **Timers:** E2E sessions set `lockGraceSeconds` to 1 or 2; the schema allows any positive whole number. The browser and server clocks are never faked. Tests move the game on by pressing ADVANCE on `/control`.
- **Restart journey:** its own Playwright project with one worker, which depends on the main project, so it runs last. Killing the shared backend would otherwise cut off tests running alongside it.
- **Finding elements:** by role and visible text first. Add `data-testid` only where those are ambiguous (about 17 files already use them).
- **When a test fails:** `retries: 0`. Keep a trace, screenshot and video for failed tests only. The HTML report goes in `e2e/playwright-report/`, and it and `test-results/` are gitignored.
- **CSV fixture:** one block of two rounds followed by a break:
  - a `free_text` question (one team answers with the key and is graded at submit time, the other answers something else and the moderator grades it);
  - a `multiple_choice` question, auto-graded;
  - one `audio` question, only to check it renders.

  `sort`, `match`, `closest_guess` and `number` stay with the real-store specs.

## Testing Decisions

- A good E2E test asserts what the people in the room see: the question on the big screen, the answer the phone shows as sent, the grade, the standings. It never asserts socket payloads or what's stored in the database.
- Game logic stays with the real-store specs. E2E covers the wiring, not every grading rule.
- Each journey file must pass five runs in a row locally (`--repeat-each=5`) before its ticket is done.

## Out of Scope

- Running E2E in CI, `pnpm test` or the pre-commit hook.
- Visual and layout regression or screenshot diffing.
- WebKit or Firefox.
- Every question type, and the authoring and editor pages beyond the one login-and-import test.
- Load testing, or many teams at once.

## Further Notes

- `DOCUMENTATION.md` says Kick is "available only for disconnected teams in the admin UI". The `/control` teams panel shows Kick for every team, and the backend closes a connected team's socket. Ticket 05 fixes the doc.
- A kicked phone forgets its stored identity and team code (`LEAVE_RULES.kicked` in `apps/frontend/app/lib/team-link.ts`). Its saved token can't bring it back, so rejoining under the same name goes through the recovery code.
