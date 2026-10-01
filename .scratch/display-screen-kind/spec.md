# Spec: /display renders the On-air screen it is sent

Status: ready-for-agent

Blocked by: None. Independent of advance-plan, session-settle and question-kind-module. The one shared touch-point is session-settle ticket 01 (named status groups), which also edits `/display`'s live-question check; whichever lands second rebases over the other.

## Problem Statement

The server already names the screen on the big screen. `getScreen` (`shared/types/src/on-air-screen.ts`) turns the game's progress into an `OnAirScreen` with a `kind`, and encodes the precedence rules once:

- the leaderboard covers everything while `isLeaderboardVisible` is on
- a break with no question under review falls back to the break intro
- an ended game shows the showdown when one is active, else the "quiz complete" screen

`/display` (`apps/frontend/app/display/page.tsx`) receives that screen in the snapshot but uses it only to read a `questionId`. It then re-derives which screen to draw by switching on `progress.status` and `progress.isLeaderboardVisible` in the same order, with its own copy of each rule (the leaderboard branch first, the `break` fallback to the intro, the `ended` branch choosing showdown vs. complete).

So "what is on the big screen" is decided twice, and nothing checks that the two agree. A new screen kind, or a changed precedence, has to be edited in the server and again in the page, and a mismatch shows up only on stage. The admin and phone views already read the on-air screen; `/display` is the one consumer left that doesn't.

## Solution

`/display` switches on `onAirScreen.kind` and renders the component for that kind. The precedence rules live only in `getScreen`.

The screen kinds stay as they are: each carries the ids it needs, and the page keeps looking up the question or round data it renders from the snapshot's `blockQuestions` / `revealQuestions` by id, exactly as it does for the question ids today. No new payload is added to `OnAirScreen`, so the admin and players views that read the same type are untouched.

The page keeps guards for data the screen's kind doesn't carry (a `question` screen with no current question yet, a `locking` screen with no lock deadline yet) and draws nothing in those cases, as today. The switch is exhaustive, so adding a screen kind fails the build until `/display` decides how to draw it.

Nothing changes on stage or in the socket contract.

## User Stories

1. As an audience member, I want the big screen to show exactly the same screen as today in every game status, so that this refactor is invisible.
2. As an audience member, I want the leaderboard, when the quiz master shows it, to cover whatever screen is under it, as today.
3. As an audience member, I want a break with no question to review yet to show the break intro, as today.
4. As an audience member, I want the end of the quiz to show the showdown while one is active and "Quiz complete!" otherwise, as today.
5. As a developer, I want the screen-precedence rules written once, in the projection, so that changing one is a single edit.
6. As a developer, I want `/display` to fail to compile when a new screen kind is added without a drawing for it, so that a screen can't silently render blank on stage.
7. As a developer, I want `/display`'s tests to assert which screen kind is on air, so that they describe the contract the page actually has with the server.

## Implementation Decisions

- **The page's screen choice becomes a `switch (onAirScreen.kind)`** with one case per kind, ending in a never-check. The inline `progress.status` chain and the separate leaderboard-first branch are deleted.
- **Kind to component:**
  - `lobby`, `rules`, `round_overview`, `round_title`, `question`, `locking`, `break_intro`, `break_review`, `break_round_title`, `reveal_intro`, `reveal`, `leaderboard`, `ended` and `showdown` each map to the component the matching `progress.status` branch draws today.
  - `break_intro` serves both the break-intro status and the break-with-no-question fallback, so the page's duplicated fallback JSX collapses into one case.
  - `ended` is "Quiz complete!" and `showdown` is the showdown reveal; the page's `activeShowdown ? … : …` ternary is deleted.
- **Data lookups stay by id.** Break review, break round title, reveal intro and reveal read their question from `blockQuestions` / `revealQuestions` by the screen's id, as the page already does for the header. `activeShowdown` and `showdownRevealStep` still come from the snapshot; the `showdown` kind only says the screen is up.
- **Data guards stay in the page.** `question` needs `currentQuestion`; `locking` needs a lock deadline; the page renders nothing otherwise, as today.
- **Not part of the screen choice, so unchanged:** the previous-leaderboard capture (`isBeforeGrading`) and `isBetweenKahootQuestions`. They're about when to remember standings for an animation, not which screen is up.
- `screenKey` and the header content already come from the projection and are untouched.

## Testing Decisions

- **A good test renders the page from a snapshot and asserts what is on screen.** It doesn't assert which component or helper ran.
- **Existing `/display` tests pass unchanged.** They already cover every screen through `progress.status`: break, reveal, rules and round intro, completion and leaderboard, lobby, question display, media, lock countdown.
- **New cases, in the existing `/display` test files, asserting by screen kind:**
  - a snapshot whose on-air screen is `leaderboard` shows the leaderboard whatever status is underneath
  - `break` with no reviewable question shows the break intro
  - `ended` with and without an active showdown
  - a `question` screen with no current question yet, and a `locking` screen with no lock deadline yet, render nothing and don't throw
- The type-level exhaustiveness check needs no runtime test: the build is the check.
- Prior art: the existing display test utilities (`apps/frontend/app/display/__tests__/test-utils.tsx`), which build snapshots.

## Out of Scope

- **Adding question or round data to `OnAirScreen`.** Considered and rejected: the data is already in the snapshot, and widening the shared type would also widen the admin and players views that read it.
- **Changing which screen shows in any status.** That's `getScreen`'s job and is untouched.
- **The players' phone**, whose own selection of what to show is the separate phone-question-selection feature.
- **Named status groups.** That's session-settle ticket 01, which this feature doesn't depend on.

## Further Notes

- Smallest of the architecture-review candidates: one ticket. It finishes the Screen projection work by making the one consumer that re-derived its own screen read the projection.
