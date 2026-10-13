# 02: Live edit delivers through the Session broadcaster

**What to build:** The Live edit module stops depending on the gateway (the transport). A quiz edit saved while sessions are running still reaches every running session's rooms once the hold is released, and a delivery failure still never hides the error that failed the save. Quiz masters see no difference.

See the parent spec: `.scratch/session-broadcaster/spec.md`.

**Blocked by:** 01 (Session broadcaster owns outcome delivery and phase timers)

**Status:** ready-for-agent

- [ ] The Live edit module injects the Session broadcaster and calls its `deliver` for each pending delivery; its swallow-on-failure handling is unchanged
- [ ] The Live edit module no longer imports the gateway
- [ ] The real-store harness passes the broadcaster to the Live edit module
- [ ] Live-edit regrade, live structural edit and quiz-edited specs pass with unchanged assertions
- [ ] Backend suite and `pnpm typecheck` pass
