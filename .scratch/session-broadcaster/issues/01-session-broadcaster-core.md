# 01: Session broadcaster owns outcome delivery and phase timers

**What to build:** A new **Session broadcaster** provider owns the one delivery step that turns a session outcome into emits, and owns the phase timers (question lock and kahoot question). The gateway hands every socket-event and disconnect outcome to it, and passes it the Socket.IO server from its init hook. Quiz masters, teams and /display see no difference: every reply, broadcast, answer list, team sync, notice and socket close arrives as today, in the same order, and timers auto-advance and survive a restart as today.

This ticket is the prefactor for the rest: the gateway's existing outbound methods (`notifySettingsUpdated`, `notifySessionClosed`, `disconnectUser`, `deliverSessionOutcome`, `notifyBonusAwardsChanged`) stay in place for now and delegate to the broadcaster where they deliver an outcome, so no caller changes yet.

See the parent spec: `.scratch/session-broadcaster/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Session broadcaster is a Nest provider registered next to the gateway, with `attach(server)` and `deliver(joinCode, outcome, sender?)`; delivery behaviour and order are unchanged (deadline re-arm first, socket closes in a `finally`)
- [ ] The broadcaster builds the phase timers with its own `deliver`, takes over the timer-scheduler injection token, restores every session's deadlines on application bootstrap and clears all timers on module destroy
- [ ] The gateway passes the server to `attach` from its init hook; guarded dispatch and disconnect handling use the broadcaster's `deliver` instead of the outcome-delivery dependency bag
- [ ] Calling `deliver` before `attach` throws a clear error and emits nothing (new test)
- [ ] An outcome delivered with no sender sends no replies but everything else in the usual order (new test, prior art: outcome-delivery-order)
- [ ] The real-store harness constructs the broadcaster, attaches the mock server through the gateway's init hook, and exposes the broadcaster on its returned handle
- [ ] Phase-timer lifecycle, question lock, kahoot timer and restart specs pass with unchanged assertions
- [ ] Full backend suite and `pnpm typecheck` pass; the backend boots with `pnpm dev:backend`
