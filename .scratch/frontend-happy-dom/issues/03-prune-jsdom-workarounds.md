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

**Status:** ready-for-agent

- [ ] Each stub listed above is either removed with its spec still green, or kept with a comment giving the current reason
- [ ] No comment in the frontend (specs, test helpers or app code) names jsdom as the reason for anything
- [ ] No production behaviour changes; the full suite is green with the same test count
