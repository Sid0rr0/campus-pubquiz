# 03: Presenter preview built from the projection

**What to build:** The /remote "now showing / next" preview comes from the Screen projection, so it can no longer drift from what /display renders. "Now showing" describes the display view's named screen. "Next" projects the session as it will be after the next Advance, with the same intercepts as today: leaderboard reveal steps, closest_guess reveal sub-steps, showdown steps, then the state machine. The hand-maintained per-status copy of the display page is deleted. The preview's shape on the wire (heading, body, optional question) and its admin-only channel stay the same. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The current-screen preview comes from the projection's named screen, with no separate per-status mirror of the display page.
- [ ] The next-screen preview is the named screen of the session after the next Advance, with today's intercept order.
- [ ] The preview payload shape is unchanged and still emitted only to the admin room. /remote needs no changes beyond any type import.
- [ ] Existing presenter-context tests pass, and they assert that preview and display agree at every step of a whole-quiz walk.
- [ ] The snapshot leak test still proves no host notes or next-screen content reach the display or players views.
