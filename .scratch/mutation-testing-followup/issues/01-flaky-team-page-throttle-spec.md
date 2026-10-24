# 01: Flaky team page throttle spec aborts `pnpm mutate`

Status: done

Blocked by: None

**Type:** bug. Work it with the `diagnosing-bugs` skill.

`apps/backend/src/team/__tests__/team-page.throttle.http.spec.ts` › "still stops night requests at their own, looser limit" fails intermittently under load. On 2026-10-24 it failed Stryker's initial test run once (`Error: socket hang up`), which aborts the whole backend `pnpm mutate`. The next full run passed.

What's known:

- It passes alone (3 out of 3) and in the full DB-free suite (`pnpm exec jest -c jest.stryker.config.cjs`, 1878 tests).
- 12 copies of the file run at once with `--coverage` failed in 2 with a different symptom: the 31st request got **404 instead of 429**. The throttler had under-counted the 30 earlier hits on the route (`NIGHT_LIMIT_PER_MINUTE = 30`, ttl 60 s, `team-page.controller.ts:18,53`).
- The spec sends 31 sequential supertest requests to `app.getHttpServer()`, which was never told to listen, so supertest calls `listen(0)` and closes the server for each request. That's the leading suspect for both symptoms, but it isn't confirmed. The test from `answers the sixth history request…` in the same file uses the same pattern with 6 requests and hasn't been seen failing.

Constraints:

- **Reproduce without fanning out.** Parallel repro loops filled swap on this machine. Use a serial loop under load instead, for example the file 30 times in a row with `--coverage`, or a one-file `stryker run --mutate src/team/team-page.controller.ts` repeated. Raise the load in steps only if that doesn't reproduce.
- Find the cause before changing the test. Candidate fixes, depending on the cause: `await app.listen(0)` in `beforeEach` so every request hits one listening server, or `request.agent(...)`. Don't paper over it with retries or a longer timeout.

Done when:

- the cause is written in `## Comments`, with the evidence;
- the fixed spec passes a serial loop of at least 30 runs under the same load that reproduced it;
- a full `pnpm --filter backend mutate` gets past the initial test run.

If the same pattern (many requests to a non-listening `getHttpServer()`) appears in other throttle specs, fix them the same way in the same commit.

## Comments

**Cause.** The throttler was not under-counting. The odd request never reached this app. supertest opens a wildcard `listen(0)` per request on a non-listening server, and under load the port it gets can already be answered on 127.0.0.1 by another process (the machine runs dev servers and more). That process replies to the request (a stray 404 or 401) or drops it (`socket hang up`).

**Evidence.**

- Serial loop: a temporary spec ran the "night limit" test 400 times in one Jest process (`--coverage`, about 20 s). The original pattern failed 3 of 400 (two `socket hang up`, one 404 instead of 429), about 0.75% per test.
- In the 404 failure, a middleware on the app counted 30 requests, one fewer than the 31 sent. The 31st never entered the Nest app, and the whole run took 27 ms, so slowness and the 60 s throttler window are ruled out.
- Calling `app.listen(0)` once per test was not enough. One run returned 401 with zero requests seen by the app, meaning the app's whole port was shadowed by a foreign listener. No Nest route returns 401, so the answer came from another process.
- Calling `app.listen(0, '127.0.0.1')` in `beforeEach` fixed it: 3 runs of 400 tests each (1200 total) with no failure, all under the same `--coverage` load.

**Fix.** `team-page.throttle.http.spec.ts` now listens once on `127.0.0.1` in `beforeEach`. The only other specs using `getHttpServer()` (`quiz-preview.http.spec.ts`, `media.http.spec.ts`) are not throttle specs and send only a few requests each, so they were left alone.
