# 01: Measure the page, and move the joker derivations out

**What to build:** Once the specs that take the rules off the phone's play page have landed, recount the page and decide whether any cleanup is left. If there is, move the phone's joker derivations (the joker marks on the round title card and the selected question; the selected question's points, verdict and joker extra) into the phone's existing joker-round module as plain functions, tested there. Teams see no change.

Parent spec: `.scratch/play-page-wiring/spec.md`

**Blocked by:** `power-up-offer` (all tickets), `coin-ledger` (all tickets), `quiz-mode-module` 04 (Delete the dead per-round quickfire gates), `doubled-rounds` 04 (Phone: round marks and the extra-joker button use the module)

**Status:** done

- [ ] The page's remaining helpers and components are listed, each with a verdict (holds a phone-only rule / pure pass-through / component boundary) and the props still typed as a whole hook result, recorded under this ticket's `## Comments`.
- [ ] If no helper is pass-through and no prop is hook-shaped: set this ticket and 02 to `wontfix` with that list as the reason, and stop.
- [ ] Otherwise the joker marks and the selected question's result are plain functions of the player view, the team's joker and purchases and the selected question, in the joker-round module beside the doubled-rounds list and the joker-extra helper; the page calls them.
- [ ] The joker-round helpers test gains cases: title card on and off a doubled round; selected question in and out of one; no selection; an ungraded selection; the joker extra on a doubled round with points, with zero points and off a doubled round.
- [ ] The 26 page-level test files pass unchanged (an edit beyond an import means behaviour changed).
- [ ] `pnpm crap:changed` passes; `pnpm mutate:changed` leaves no survivors in the joker-round module.

## Comments

Measurement (page.tsx, 738 lines before the move; 16 functions):

| Helper / component | Verdict |
| --- | --- |
| `PlayPageContent`, `useCodeInUrl`, `JoinScreen`, `ConnectingScreen`, `ConnectionNotices`, `TeamHeader`, `StatusSection`, `BreakRatingCard`, `FinalFeedback` | component boundary (keep) |
| `JoinedPlayScreen`, `BlockBrowser` | component boundary; props hook-shaped (below) |
| `jokerMarksOf`, `selectedResultOf` | phone-only rule: moved to `joker-round.ts` |
| `sidePanelsOf`, `powerUpsListOf` | pass-through of game/view fields plus the buy-then-show-moment wrapper: inline candidates (ticket 02) |
| `shownCoins` | thin call into `coinsShown`: inline candidate (ticket 02) |

Hook-shaped props still: `JoinedPlayScreen.browser` / `.saved` / `.powerUpMoment`, `BlockBrowser.browser` / `.onSubmitAnswer`, plus `game` and `join` passed whole to `StatusSection`, `BlockBrowser`, `BreakRatingCard`, `FinalFeedback`, `ConnectionNotices`. Pass-through helpers and hook-shaped props remain, so the wontfix condition does not hold; ticket 02 stays open.
