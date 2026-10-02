# Spec: The backend suite runs in under a minute and never fails by chance

Status: ready-for-agent

## Problem Statement

The backend suite has about 1,180 Jest tests. The number is fine; the run time and reliability aren't:

- **A full run takes about 4 minutes** (measured 2026-10-02: 236s), against 12s for the frontend and under 1s for shared types. Every TDD loop that touches the Live session module, grading or standings pays for it, and so does every CI run.
- **About three quarters of that time is set-up, not testing.** Adding up each spec file's run time gives about 1,046s, but the test bodies take only about 239s. A file with five tests takes 15–20s. Each spec file that touches Postgres starts its own Postgres testcontainer, connects MikroORM and runs every migration in `beforeAll`, then stops the container in `afterAll`. That happens in 83 spec files. The same block is copied in 11 places: the three shared harnesses (real-store gateway, answer service, showdown service) and eight specs that inline it.
- **About 48s goes on waiting in real time.** Some specs sleep a fixed 100–300ms and hope the gateway has finished in the meantime. The session write spec does this about a dozen times and takes 92s on its own. The lock-timer and kahoot auto-advance specs arm real 1s timers, poll for up to 10s, and wait out 2.5s "quiet periods" to prove that nothing happened.
- **The suite fails by chance.** One run on 2026-10-02 had 3 failures and the next had none, with no code change in between. Fixed sleeps on a machine busy starting a container per file are the likely cause. A red run that goes green on a retry teaches everyone to ignore red runs.

## Solution

The backend suite gets the same tests, the same assertions and the same real-Postgres coverage, but:

- **One Postgres container per test run, not one per spec file.** It starts once before any spec runs, migrates a template database once, and gives each Jest worker its own database cloned from that template. Spec files share their worker's database, and every test still starts from empty game tables.
- **Specs wait for the session, not the clock.** A gateway test can wait until everything in flight for its session has been written, instead of sleeping and hoping.
- **Timer specs don't wait out real timers.** A gateway test can see whether a session's lock or kahoot timer is armed and when it is due, and can make it fire immediately. "Auto-advances when the timer elapses" and "doesn't arm a timer" then run in milliseconds.

The target is a full backend run under 60s on a developer laptop, and ten consecutive full runs with no failures.

## User Stories

1. As a developer, I want the full backend suite to finish in under a minute, so that I run it before every commit instead of skipping it.
2. As a developer doing TDD on the Live session module, I want a single gateway spec file to run in a couple of seconds, so that red-green-refactor stays a tight loop.
3. As a developer, I want a red test to mean a real regression, so that I never have to rerun the suite to find out whether a failure is real.
4. As a developer, I want a spec that needs Postgres to say so in one line, so that I don't copy a container-and-migrate block into a new spec.
5. As a developer, I want every test to start from empty game tables, so that sharing a database between spec files can't leak rows from one test into the next.
6. As a developer, I want each Jest worker to have its own database, so that specs running in parallel never truncate each other's rows.
7. As a developer, I want migrations to run once per test run, so that adding a migration doesn't make every spec file slower.
8. As a developer, I want the test database to be built from the same migrations production uses, so that tests still catch a migration that doesn't match its entities.
9. As a developer, I want the container to be stopped when the run ends, even if it failed, so that repeated runs don't leave Postgres containers behind.
10. As a developer, I want a clear error when Docker isn't running, so that I know the fix is to start Docker and not to debug a test.
11. As a developer writing a gateway spec, I want to wait until my session's in-flight writes have all finished, so that I can assert on what the big screen, `/control` and the phones were sent without sleeping.
12. As a developer writing a session write race test, I want to hold one call, start a second event, release the first and then wait for the session to settle, so that the race comes out the same way on every run.
13. As a developer writing a lock-timer spec, I want to make the session's armed lock timer fire immediately, so that "locks when the timer elapses" doesn't take a real second plus polling.
14. As a developer writing a kahoot spec, I want to make the session's armed kahoot question timer fire immediately, so that auto-advance tests run in milliseconds.
15. As a developer, I want to check that no timer is armed for a session, so that "doesn't arm a timer when the setting is null" doesn't need a 2.5s quiet period.
16. As a developer, I want to read when a session's timer is due, so that "restarting a question re-arms the timer from now" is checked against a number and not a stopwatch.
17. As a developer, I want firing a timer in a test to run the same expiry path production runs, so that the test proves the real auto-lock and auto-advance behaviour.
18. As a developer, I want a timer that fires after its test has ended to be impossible, so that a leftover timer can't write into the next test's tables.
19. As a developer, I want the shared harnesses to keep their names and their returned handles, so that the existing test bodies don't change at all.
20. As a developer reviewing the change, I want the test count before and after to be the same, so that I can see no test was dropped to buy speed.
21. As a developer, I want CI to run the backend suite the same way it runs locally, so that a CI-only failure is a real difference and not a set-up quirk.
22. As a quiz master, I want changes to the live game to stay as well tested as they are now, so that speeding up the suite doesn't make a quiz night riskier.

## Implementation Decisions

### The test database module

- A new test-only module is the single way a backend spec gets a database. It's called inside a top-level `describe`, like the existing harnesses, and returns a handle that exposes a connected MikroORM. It registers its own hooks: connect before the file, truncate every game table after each test, close the connection after the file.
- Its interface is deliberately small: "give me a migrated, empty database for this file". Container start-up, template creation, per-worker database naming and the truncate list are hidden behind it. One place lists the tables to truncate, derived from the entity metadata rather than hand-maintained, so that a new entity can't be missed.
- **Behind the seam:** a Jest global set-up starts one `postgres:16-alpine` testcontainer, creates a template database and runs the real migrations against it once. Each worker, on first use, creates its own database from that template (`CREATE DATABASE … TEMPLATE …`), named after the Jest worker id. The global teardown stops the container. The connection details reach workers through the environment the global set-up writes, not through a file in the repo.
- If Docker isn't available, the global set-up fails with one message saying Docker is required, not a stack trace per spec file.
- The three shared harnesses (real-store gateway, answer service, showdown service) and the eight specs with an inline container block switch to this module. The harnesses' names, parameters and returned handles stay as they are, so no test body changes.
- Truncating between tests stays the isolation strategy (it's what the harnesses already do). Rolling back a transaction per test was considered and rejected: the gateway forks its own entity managers per request, so writes don't share one transaction.

### Waiting for a settled session

- The session write queue gets a read-only way to wait for a join code to go idle: a promise that resolves once every write queued for that join code at that moment, and any write those writes queue, has finished. This is a real seam on a production module, not a test hook. It only observes the queue's existing tail and changes nothing about ordering.
- The real-store gateway harness exposes this as a `settled()` call on the game handle. It resolves once the session write queue for the game's join code is idle and pending microtasks have flushed, so that broadcasts sent at the end of a write have been recorded by the mock server.
- The session write spec, the session room scoping spec, the state transitions spec and the quiz service spec replace their fixed sleeps and poll-then-sleep helpers with `settled()`, or with the existing hold/release helper where the test needs to control ordering.

### Driving phase timers

- The question lock timer registry takes an optional scheduler (the arm and clear pair). The default is the real `setTimeout`/`clearTimeout`, so production behaviour is unchanged. The gateway builds its lock and kahoot registries with that default unless the harness provides one.
- The real-store gateway harness provides a manual scheduler and exposes, per game handle, for both the lock timer and the kahoot question timer: whether one is armed, when it is due (epoch ms), and a call that fires it now and then waits for `settled()`. Firing runs the registry's own expiry callback, so the auto-lock and auto-advance paths are the production ones.
- The harness clears every armed timer when a test ends, as `onModuleDestroy` already does, so nothing fires into the next test.
- The lock-timer, lock-timer isolation, kahoot auto-advance and outcome-delivery-and-timers specs switch from polling real timers to these calls. Their test names and assertions about what each room is sent stay the same. "Doesn't arm" and "re-arms on restart" become assertions on armed state and due time.
- Jest fake timers were considered for this and rejected: the Postgres driver and MikroORM use real timers internally, so faking them globally risks hangs. The existing `freezeClockAt` helper, which fakes only `Date`, stays as it is.

### Configuration

- The backend Jest configuration gains the global set-up and teardown. The worker count stays at Jest's default. If one container turns out to be a bottleneck under the default worker count, cap the workers rather than going back to a container per file.
- CI already runs `pnpm test` with Docker available, so it needs no change beyond what the Jest configuration brings.

## Testing Decisions

- **What makes a good test here:** this work changes how the tests run, not what they check. The existing ~1,180 backend tests are the acceptance test. They must all pass, with the same count and unchanged test bodies (apart from replacing sleeps and timer polling), before and after.
- **New behaviour gets its own tests at the highest seam:**
  - The test database module: two spec files that insert rows in one test each see empty tables in their next test. Two workers never see each other's rows (assert on the database name per worker). A table added to the entity metadata is truncated without being listed anywhere.
  - The session write queue's idle wait: it resolves immediately when nothing is queued. It waits for a write that's running and for a write queued behind it. It still resolves when a queued write throws. It doesn't wait for another join code's writes. These sit alongside the existing session write queue tests.
  - The timer registry's scheduler: with a manual scheduler, re-arming replaces the earlier timer, clearing leaves nothing armed, and firing runs the expiry callback once. The real-scheduler path is already covered by the phase timer and lock-timer specs.
- **Prior art:** `holdNextCall` and `freezeClockAt` in the real-store gateway harness (deterministic hold/release and clock control without sleeps); the existing harness pattern of registering hooks from inside a `describe` (`setupRealStoreGatewayTest`, `setupAnswerServiceTest`); the session write spec's race tests, which this work makes deterministic.
- **Measuring the result:** record the full backend run time and the per-file breakdown (`jest --json`) before and after in the ticket that lands the test database module, and run the full suite ten times in a row to show it no longer fails by chance.

## Out of Scope

- Reducing the number of tests, merging spec files, or deleting tests that look redundant. The count isn't the problem.
- The frontend (Vitest) and shared-types suites. They take 12s and under 1s.
- Replacing Postgres testcontainers with an in-memory or SQLite database. Tests must keep running against the real database and the real migrations.
- Switching the backend from Jest/ts-jest to Vitest or SWC. That might shave transform time, but it's a separate decision with its own risks.
- The Nest e2e config, which has a single spec and isn't part of `pnpm test`.
- Changing production timer behaviour or the session write ordering. The scheduler and idle-wait seams must not change what production does.

## Further Notes

- Measured baseline (2026-10-02, laptop): backend 1,182 tests in 236s; the 20 slowest spec files took 14–92s each; 26 tests over 1s added up to about 48s; one of two consecutive runs had 3 failures.
- This replaces "one container per spec file" from the real-store gateway harness ticket (live-session-module, issue 01). That was a starting point copied from the answer/team/stats specs, not a recorded decision.
- Suggested ticket order: (1) the test database module plus moving the shared harnesses and inline specs onto it, which saves the most time; (2) the session write queue's idle wait and `settled()`, then removing sleeps; (3) the timer scheduler seam and the timer specs. Each ticket keeps the suite green on its own.
- The one-instance, in-memory session write queue is an accepted design (see CLAUDE.md). The idle wait relies on it and doesn't need to work across processes.
