# 01: Unmocked network requests fail the frontend suite

**What to build:** A frontend spec that makes a network request no test has mocked fails, with an error naming the method and URL, instead of quietly reaching whatever listens on the backend address. Today the result of some `/control` specs can depend on whether a dev backend happens to be running on `:3000`; after this ticket it can't.

This is the prefactor for the happy-dom switch, done on jsdom so the switch itself starts clean. The guard lives in the shared Vitest setup and covers the global `fetch` (and any other request path the app uses, if there is one). Then every spec that trips it gets the escaping call mocked through the module it already mocks for the backend client, or asserts on the call if the request is the behaviour under test. No new mocking layer.

Where to look: a happy-dom trial on 2026-10-14 logged refused requests to the backend from these specs: `/control` previous-button, keyboard-shortcuts, end-quiz-and-close-session, join-overlay, leaderboard, rejected-actions, advance-controls, and `/display` media-rendering. jsdom swallows those failures silently, so if the guard doesn't fire for them on jsdom, find out which request path they use before closing the ticket — the guard must catch it.

Parent spec: `.scratch/frontend-happy-dom/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A spec that calls an unmocked endpoint fails with a message naming the method and URL (proved by a test of the guard itself)
- [x] Every spec listed above passes with its backend request mocked or asserted, not reaching the network
- [x] A full frontend run gives identical results with the dev backend stopped and with it running on `:3000`
- [x] The full suite stays green with the same test count as before the ticket (1,150 before; 1,152 after = the guard's own 2 tests)

## Comments

**What escaped.** On jsdom the global `fetch` is Node's, so the unmocked calls did reach `localhost:3000` (and failed silently when nothing listened). Two calls escaped, both from `/control` `page.tsx` through modules the specs did not mock: `fetchAnswers` (`GET /sessions/<code>/answers/<id>`, `answer-api`) in 9 specs (advance-controls, end-quiz-and-close-session, join-overlay, keyboard-shortcuts, leaderboard, previous-button, rejected-actions, plus server-decided-flags and status-and-teams, which the trial list missed), and `fetchQuizzes` (`GET /quizzes?joinCode=...`, `quiz-api`) in session-routing. The `/display` media-rendering spec does not call `fetch` at all: the refused request in the happy-dom trial was the YouTube iframe, which jsdom never loads, so there is nothing to mock there (ticket 02 pins iframe loading off in the happy-dom config).

**How it was fixed.** `test-utils/unmocked-fetch-guard.ts` replaces `globalThis.fetch` in `vitest.setup.ts`. An unmocked call rejects with `Unmocked network request: <METHOD> <URL>` and is also recorded, so the global `afterEach` fails the spec even if app code swallows the rejection (cleanup runs before that throw so one failure does not cascade). Specs that stub `fetch` themselves are unaffected, since their stub replaces the guard. The app uses only `fetch` (no XHR, `sendBeacon` or axios), and socket.io is mocked in specs, so `fetch` is the only path to guard. The 10 escaping specs now mock `answer-api` (`fetchAnswers` resolves `null`, same as bonus-award-confirmation) and, for session-routing, `quiz-api`, via the same `vi.mock` pattern the neighbouring specs use.

**Verification.** With the guard on, the full suite only goes green when no spec makes an unmocked request, so its result cannot depend on what listens on `:3000`.
