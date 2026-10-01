# 01: /display renders by the On-air screen's kind

**What to build:** `/display` chooses what to draw with an exhaustive switch on `onAirScreen.kind` instead of re-deriving the screen from `progress.status` and `isLeaderboardVisible`. Each kind maps to the component its matching status branch draws today. The break-with-no-question fallback and the ended-with/without-showdown choice come from the kind (`break_intro`, `ended`, `showdown`), so the page's duplicated fallback and ternary go away. Question, break and reveal data is still looked up from the snapshot by the screen's id; `question` and `locking` keep their guard for a missing current question or lock deadline and draw nothing in that case. Nothing changes on stage or in the socket contract.

Parent spec: `.scratch/display-screen-kind/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The page switches on `onAirScreen.kind` with one case per kind and a never-check; adding a kind without a drawing fails the build
- [ ] The inline `progress.status` chain, the separate leaderboard-first branch, the duplicated break-fallback JSX and the `activeShowdown` ternary are deleted from `/display`
- [ ] Existing `/display` tests pass unchanged
- [ ] New cases: a `leaderboard` screen covers any underlying status; `break` with no reviewable question shows the break intro; `ended` with and without an active showdown; a `question` screen with no current question and a `locking` screen with no lock deadline render nothing without throwing
- [ ] The previous-leaderboard capture and `isBetweenKahootQuestions` are untouched
- [ ] No new fields on `OnAirScreen`; the admin and players views are unchanged
