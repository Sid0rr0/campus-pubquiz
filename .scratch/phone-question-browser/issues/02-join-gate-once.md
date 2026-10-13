# 02: Join gate defined once in the Team link

**What to build:** Whether a phone should show the join form is decided once, by the Team link hook, instead of being copied into /play and the home page's join panel. The form is shown when there is no team name, or no join code and no view yet, or a connection error with no team. That is exactly today's rule, so no team ever gets stuck on "Connecting…" and both entry points always agree.

This is a prefactor that only adds to the hook's current flat result. Nothing is reshaped yet.

See the parent spec: `.scratch/phone-question-browser/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Team link hook's result gains **needs join form**, computed from the team name, the active join code, the view, the connection error and the team
- [ ] /play and the home page's join panel read it; their copied gate and the "mirrors /play" comment are removed; the join panel's own connecting vs joined split is unchanged
- [ ] The /play Team link fake gains the field, read lazily from localStorage like the team name, so existing `joinAsTeam` helpers keep working
- [ ] New hook tests (test-first): the join form is needed with no team name, with a restored name but no join code and no view, and with a connection error and no team; it is not needed once a view has arrived
- [ ] New test: /play and the join panel show the join form in the same gate cases, driven from the same fake
- [ ] Join and reconnect, logout and errors, pre-game screens and home page tests pass with unchanged assertions
- [ ] Frontend suite, `pnpm typecheck` and `pnpm lint` pass
