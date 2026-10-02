# 05: Prove the backend suite is fast and never fails by chance

**What to build:** Evidence that the spec's goal is met: the full backend suite runs in under 60s on a developer laptop, and passes ten times in a row with no failures. Anything still slow or flaky is either fixed here (if small) or written up as a follow-up ticket in this feature directory.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 02 (Every remaining Postgres spec uses the shared test database), 04 (Gateway specs fire phase timers on demand).

**Status:** ready-for-agent

- [ ] Full backend run time and the 10 slowest spec files (`jest --json`) recorded in Comments, next to ticket 01's baseline (236s).
- [ ] Full backend run under 60s, or, if not, the remaining cost broken down (set-up vs test bodies vs transform) with a follow-up ticket for the biggest part.
- [ ] Ten consecutive full backend runs pass with no failures. The run log summary is in Comments.
- [ ] No spec left with a fixed-duration sleep used to wait for the gateway (searched and listed in Comments; any intentional one has a comment explaining why).
- [ ] The backend test count is the same as at the start of ticket 01.
- [ ] CI's `pnpm test` passes.
- [ ] Spec status set to `done`.
