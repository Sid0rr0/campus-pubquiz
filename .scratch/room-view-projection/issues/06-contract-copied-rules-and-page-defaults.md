# 06: Contract: delete the copied rules and the page defaults

**What to build:** Now that every page test gets its view from the shared projection, the old half-server helpers and the defaults they needed go away. The role pages destructure their view as typed, so a page that reads a field its room isn't sent fails typecheck instead of rendering a fallback.

- Delete the three per-role view helpers (players, display, admin), with their copied answerability rule, "between kahoot questions" rule and Advance/Previous status lists. The hook-result helpers stay.
- Remove the fallback defaults on view fields in the `/display`, `/play` and `/control` pages (about 45: the destructuring defaults and the `??` fallbacks on the Advance step, the Previous state and the active block start). The `/play` page's hook-result defaults (its answers, ratings, seen questions) are not view fields and stay, and so do component props that are genuinely optional (media flags, replay tokens).
- `CODING_STANDARDS.md` gains: "the frontend renders the view it is sent and never projects one itself; only test fixtures run the projection", and "page tests build views with the fixture builder, never by hand; pages don't default fields their view always carries."

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 03, 04, 05

**Status:** done

- [x] No per-role view helper or copied server rule is left in the frontend's test support.
- [x] The role pages carry no fallback default for a field their view type always has.
- [x] Nothing a page renders changes. The frontend suite passes, apart from tests that assert on a fallback state the server never sends; those are removed or corrected, and noted in the ticket's comments.
- [x] `CODING_STANDARDS.md` has both rules.
- [x] `pnpm typecheck`, `pnpm lint` and every workspace's suite pass.

## Comments

Deleted `app/display/__tests__/test-utils.tsx` (`displayView`, `progress`, `question`: nothing imported them) and, from `app/control/__tests__/test-utils.tsx`, `adminView`, `progress`, the Advance/Previous status lists and their default-availability rule. The hook-result helpers (`adminGameResult`, `authenticatedAuthResult`, `getDesktopButton`, `socketResult`, `seenQuestionsOf`) stay.

Defaults removed: `/display` 22 (all destructuring defaults, including `quizStructure`, `settings`, `displayTextScale`), `/play` 11 (`quizStructure`, `blockQuestions`, `upcomingQuestions`, `revealQuestions`, `isCurrentRoundKahoot`, `closestGuessRevealStep`, `settings`, `activeShowdown`, `showdownRevealStep`, `isAnswerable`, `feedback`), `/control` 7 (destructuring defaults plus the `activeBlockStartIndex` fallback).

Kept: `/play` hook-result defaults (`myAnswers`, `myAnswerGrades`, `myBonusAwards`, `myRoundRatings`, `roundRatingsEpoch`, `myFeedback`, `seenQuestions`). On `/control`, `snapshot?.advanceStep ?? 'none'` and `snapshot?.previousState ?? 'unavailable'` stay: `useAdminKeyboardShortcuts` runs before the page's null-snapshot early return, so these cover "no view yet", not a missing view field. Likewise `?? false` on `isLeaderboardVisible` and the `snapshot?.` fallbacks for settings in the lock-countdown hook calls.

No test asserted on a fallback state the server never sends, so none was removed or changed; the frontend suite passes unchanged.
