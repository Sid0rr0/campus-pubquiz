# 04: Gateway is inbound only

**What to build:** The gateway only handles incoming socket events: accepting connections, guarded dispatch, and handing outcomes to the Session broadcaster. Its outbound methods and the dependencies it only held for delivery and timers are removed. The architecture docs and glossary name the Session broadcaster, so the next reader finds the outbound side without reading the gateway. No behaviour changes.

See the parent spec: `.scratch/session-broadcaster/spec.md`.

**Blocked by:** 02 (Live edit delivers through the Session broadcaster), 03 (REST notifications go through the Session broadcaster)

**Status:** ready-for-agent

- [ ] The gateway's `notifySettingsUpdated`, `notifySessionClosed`, `disconnectUser`, `deliverSessionOutcome` and `notifyBonusAwardsChanged` are deleted
- [ ] The gateway's constructor takes only the Live session façade, the auth SessionService and the Session broadcaster (no AnswerService, ORM or timer schedulers)
- [ ] Nothing outside the app module and tests imports the gateway
- [ ] Any spec still reaching outbound behaviour through the gateway is retargeted to the broadcaster, with unchanged assertions
- [ ] The architecture diagram shows controllers, Live edit, phase timers and the gateway pointing to the Session broadcaster, which points to the Socket.IO adapter; the "timers → gateway" and "rest → gateway" edges are gone
- [ ] GLOSSARY gains a **Session broadcaster** entry: what the backend pushes to connected clients, and the one delivery step for every outcome
- [ ] Full backend suite, `pnpm typecheck` and `pnpm lint` pass; the backend boots with `pnpm dev:backend`
