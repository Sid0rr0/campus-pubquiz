# Spec: The frontend suite runs on happy-dom instead of jsdom

Status: ready-for-agent

## Problem Statement

The frontend suite (116 Vitest files, 1,150 tests) spends most of its time building a fake browser, not running tests. Measured on 2026-10-14, run on the local limit of 50% of cores:

- **jsdom takes about 16s for a full run.** In Vitest's breakdown, setting up the environment (about 30–42s summed across workers) is the largest item, ahead of the test bodies (about 19–20s). Every file builds a new jsdom window.
- **Every red-green-refactor loop on `/play`, `/display` or `/control` pays that cost**, and so does the pre-push/CI run. The backend suite was cut from 34s to about 19s the same day, so the frontend is now the slower half of the run.

A throwaway trial on the same machine (happy-dom 21, `--environment=happy-dom`, no other change) ran **all 1,150 tests green in about 9.5s**, with environment set-up down to about 14s summed. The test lists of both runs were identical.

## Solution

The frontend's Vitest environment switches from jsdom to happy-dom. Nothing else about the tests changes: the same files, the same Testing Library queries, the same assertions. A full local run drops from about 16s to about 10s, and CI's run drops by the same share.

Along the way, the switch surfaces one hidden problem that it must not hide again. Under happy-dom, several `/control` specs (and one `/display` media spec) log real network requests to the backend address that are refused, because nothing listens there during a test run. Under jsdom these failures are swallowed silently, so whether they happen today is not visible. A spec that reaches the network gets a different result depending on whether a dev backend happens to be running on `:3000`. The switch finds those requests and makes them fail loudly instead.

## User Stories

1. As a developer running the frontend tests in a TDD loop, I want a full run to take about 10s instead of about 16s, so that I run it more often.
2. As a developer, I want a single spec file to start faster, so that `pnpm --filter frontend test <path>` feels instant.
3. As a developer, I want every existing frontend spec to pass unchanged on the new environment, so that the switch doesn't rewrite any test's intent.
4. As a developer, I want the test count before and after the switch to be identical, so that I know no spec was skipped or silently dropped.
5. As a developer, I want a spec that makes an unmocked network request to fail with a message naming the URL, so that a test never depends on whether a dev backend is running.
6. As a developer with the dev backend running on `:3000`, I want the frontend suite to give the same result as with it stopped, so that local and CI runs agree.
7. As a developer reading a spec, I want comments that blame "jsdom" for a stub to say what the stub is for now, so that I don't keep workarounds for a library we no longer use, or delete one we still need.
8. As a developer, I want stubs that happy-dom makes unnecessary (pointer-capture, `scrollIntoView`, `HTMLMediaElement.play/pause`) to be removed only if their specs still pass without them, so that cleanup is proven, not assumed.
9. As a developer, I want the test environment never to load external pages, scripts or stylesheets (YouTube iframes, media URLs), so that the suite stays offline and deterministic.
10. As a developer, I want the test output free of happy-dom network-error noise, so that real failures stand out.
11. As a CI maintainer, I want CI to keep using the default worker count and simply get faster, so that nothing about the pipeline changes.
12. As a developer running parallel agent sessions, I want the 50% local worker limit to keep working unchanged, so that the timeouts it fixed don't come back.
13. As a developer, I want jsdom removed from the frontend's dependencies once nothing uses it, so that there is one test DOM, not two.
14. As a moderator, I want nothing about `/control`, `/display` or `/play` to change in the browser, so that this stays a test-only change.

## Implementation Decisions

- **One environment for the whole frontend suite.** The Vitest config's `environment` becomes happy-dom. No per-file `@vitest-environment` overrides: no spec uses them today, and a split environment would bring back the jsdom start-up cost for those files.
- **jsdom leaves the frontend's dev dependencies** in the same change, and happy-dom is added. No other package imports jsdom.
- **External resource loading stays off.** happy-dom's own settings already refuse to load iframe pages (seen in the trial: the YouTube embed in the `/display` media spec was refused, not fetched). The config pins that explicitly, together with JavaScript and CSS file loading turned off, so a happy-dom upgrade can't quietly turn them on.
- **A network request that a spec didn't mock fails the spec.** The shared Vitest setup makes a fetch that no test has stubbed throw an error naming the method and URL. The specs that reach the backend today (seen in the trial: previous-button, keyboard-shortcuts, end-quiz-and-close-session, join-overlay, leaderboard, rejected-actions, advance-controls under `/control`, and media-rendering under `/display`) get their request mocked through whatever module they already mock for the backend client, or assert on it. The goal is to find which call escapes the existing mocks, not to add a new mocking layer.
- **jsdom-specific workarounds are reviewed one by one, not removed in bulk:**
  - Radix Select pointer-capture and `scrollIntoView` stubs (in the live-session select, home page and `/play` join/logout specs): drop each one only if its spec still passes without it.
  - The `HTMLMediaElement.play/pause` spies in the lock-countdown-sound spec stay: the spec asserts on them, not just around them. Only the comment changes.
  - The `motion/react` AnimatePresence passthrough in the display completion/leaderboard spec stays unless that spec passes without it.
  - The `/control` test helper that scopes Advance/Previous to the desktop sidebar stays: happy-dom doesn't evaluate CSS media queries either. Only the comment changes.
- **Production code is untouched,** except comments that name jsdom. The `ResizeObserver` guard in the phone's sort answer stays: it's also a real-browser safety net. Its comment stops claiming the test environment lacks `ResizeObserver` (happy-dom has it, so specs now exercise the measuring path, and they passed in the trial).
- **The local worker limit (50% of cores) and CI's default are unchanged.**
- **No project docs change.** No file under `DOCUMENTATION.md`, `CODING_STANDARDS.md`, `README.md` or the frontend `CLAUDE.md` names jsdom.

## Testing Decisions

- **The seam is the existing suite as a whole.** No new seams or test helpers beyond the unmocked-fetch guard in the shared setup. A good outcome is the same behaviour-level specs (Testing Library queries by role and text) passing unchanged on the new environment.
- **Proof of the switch:** a full run on happy-dom passes with the same test count as the last jsdom run (1,150 as of 2026-10-14), comparing test names from the JSON reporter, not just the totals.
- **Proof of the speed-up:** full local runs before and after, three of each, with the median recorded on the ticket.
- **Proof of the network guard:** a full run with the dev backend stopped and one with it running give identical results, and the output contains no `ECONNREFUSED` or happy-dom `Fetch.onError` lines.
- **Proof that no flakiness came in:** five consecutive full runs green.
- **Prior art:** the backend test-speed spec (`.scratch/backend-test-speed/`) used the same "same tests, measured before/after, N green runs in a row" bar.

## Out of Scope

- Moving any spec to a real browser (Playwright component tests) for layout or CSS media-query behaviour.
- Rewriting specs to need fewer mocks, or changing what any spec asserts.
- Further changes to Vitest worker counts, pools or isolation (`isolate: false` and similar).
- The backend and shared-types suites.

## Further Notes

- happy-dom is a different DOM implementation, not a faster jsdom: it covers less of the spec in places (layout, some form and media APIs) and more in others (`ResizeObserver`). The suite passing is the evidence that our specs don't depend on the differences. A future spec that does need a missing API should stub it locally, as the current specs do.
- The trial used happy-dom 21.0.1 with Vitest 3.2 and was reverted. Nothing from it is in the repo.
