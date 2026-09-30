# 03: Presenter preview built from the projection

**What to build:** The /remote "now showing / next" preview comes from the Screen projection, so it can no longer drift from what /display renders. "Now showing" describes the display view's named screen. "Next" projects the session as it will be after the next Advance, with the same intercepts as today: leaderboard reveal steps, closest_guess reveal sub-steps, showdown steps, then the state machine. The hand-maintained per-status copy of the display page is deleted. The preview's shape on the wire (heading, body, optional question) and its admin-only channel stay the same. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** done

- [x] The current-screen preview comes from the projection's named screen, with no separate per-status mirror of the display page.
- [x] The next-screen preview is the named screen of the session after the next Advance, with today's intercept order.
- [x] The preview payload shape is unchanged and still emitted only to the admin room. /remote needs no changes beyond any type import.
- [x] Existing presenter-context tests pass, and they assert that preview and display agree at every step of a whole-quiz walk.
- [x] The snapshot leak test still proves no host notes or next-screen content reach the display or players views.

## Comments

Implemented in the commit that rewrites `apps/backend/src/game/state/screen-preview.util.ts`. `describeScreen` now asks `projectScreen` which screen is on air and only supplies its wording; the per-status switch over the display page is gone. `buildPresenterContext` moved into the same file, which removes the import cycle the projection would otherwise have created. The next-screen preview keeps today's intercept order and projects the hypothetical session through the same path. The wire shape and admin-only channel are untouched, so /remote needed no change. Tests: a new walk in `presenter-context.spec.ts` asserts, step by step, that the current preview matches the display's named screen and that each next preview equals the following current one; the existing presenter-context and snapshot-leak specs pass. Full backend and frontend suites, lint and tsc pass. Status set to `done`.
