# 03: Workarounds written for jsdom are pruned or reworded

**What to build:** Every stub and comment that exists because of jsdom says what it's for under happy-dom, or is gone. A developer reading a spec no longer meets workarounds for a library the project doesn't use, and no workaround that's still needed is deleted on a guess.

Review each one and remove it only if its spec passes without it:

- The Radix Select pointer-capture and `scrollIntoView` stubs in the live-session select, home page and `/play` join/reconnect and logout specs.
- The `motion/react` AnimatePresence passthrough in the display completion-and-leaderboard spec.

These stay, with comments that no longer blame jsdom:

- The `HTMLMediaElement.play/pause` spies in the lock-countdown-sound spec — the spec asserts on them.
- The `/control` test helper that scopes Advance/Previous to the desktop sidebar — happy-dom doesn't evaluate CSS media queries either.
- The `ResizeObserver` guard in the phone's sort answer — production code, and a real-browser safety net; its comment stops claiming the test environment lacks `ResizeObserver`.

Parent spec: `.scratch/frontend-happy-dom/spec.md`

**Blocked by:** 02 (The frontend suite runs on happy-dom)

**Status:** done

- [x] Each stub listed above is either removed with its spec still green, or kept with a comment giving the current reason
- [x] No comment in the frontend (specs, test helpers or app code) names jsdom as the reason for anything
- [x] No production behaviour changes; the full suite is green with the same test count

## Comments

**Removed.** The Radix Select pointer-capture (`hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`) and `scrollIntoView` stubs, with their `beforeAll` and import, in the live-session-select, home-page, `/play` join-and-reconnect and `/play` logout-and-errors specs. The `join-form` spec carried the same unlabelled stub block and went too. Each spec passed without them on repeated runs.

**Kept.** The `AnimatePresence` passthrough in the display completion-and-leaderboard spec. Without it the between-questions leaderboard test fails (the outgoing screen lingers as an empty opacity-0 wrapper), so the comment now gives the happy-dom reason. The same passthrough in `screen-kind` was not in scope and is untouched. The `quiz-outline` `scrollIntoView` stubs stay, since that spec asserts on the calls.

**Reworded.** `use-lock-countdown-sound` (spies exist because the spec asserts on play/pause), the `/control` `getDesktopButton` helper (happy-dom does not evaluate media queries either), and the `ResizeObserver` guard in `play/sort-answer.tsx` (comment only: guard is for environments without `ResizeObserver`). `grep -ri jsdom` over `apps/` now finds nothing.

**Extra: iframe noise.** The `/display` media-rendering spec now spies on `console.error` in `beforeEach`, drops only messages containing "Iframe page loading is disabled", forwards everything else, and restores in `afterEach`. A full run's output has no happy-dom iframe lines.

**Verification.** Full frontend suite: 117 files, 1,152 tests, green. `pnpm typecheck` and `pnpm lint` clean.
