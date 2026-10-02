# 04: Gateway specs fire phase timers on demand

**What to build:** A gateway spec can see whether its session's lock timer or kahoot question timer is armed, read when it's due, and make it fire immediately. The fired timer runs the same expiry path production runs. "Auto-locks when the timer elapses", "auto-advances the kahoot question" and "doesn't arm a timer when the setting is null" then run in milliseconds, instead of arming real 1s timers, polling for up to 10s and waiting out 2.5s quiet periods.

The question lock timer registry takes an optional scheduler (an arm and clear pair). Its default is the real `setTimeout`/`clearTimeout`, so production behaviour is unchanged. The gateway builds its lock and kahoot registries with the default unless the real-store harness provides a manual scheduler. The harness exposes, per game handle and for each of the two timers: whether one is armed, its due time (epoch ms), and a fire-now call that runs the expiry and then waits for `settled()`. The harness clears every armed timer when a test ends, so nothing fires into the next test's tables.

The question lock auto-advance, lock-timer isolation, kahoot question auto-advance and outcome-delivery-and-timers specs switch to these calls. Their test names and their assertions about what each room is sent stay the same. "Doesn't arm" and "re-arms on restart" become assertions on armed state and due time.

Jest fake timers are not used for this: the Postgres driver and MikroORM rely on real timers. `freezeClockAt` (which fakes only `Date`) stays as is.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 03 (Gateway specs wait for a settled session instead of sleeping), because fire-now waits for `settled()`.

**Status:** done

- [x] Written first: with a manual scheduler, re-arming a session's timer replaces the earlier one; clearing leaves nothing armed; firing runs the expiry callback exactly once; another session's timer is untouched.
- [x] The real scheduler path stays covered by the existing phase timer and lock-timer specs, which pass unchanged.
- [x] The four timer specs use armed-state, due-time and fire-now calls, with no real-time polling, quiet periods or sleeps left.
- [x] Each of the four specs takes under 3s on its own.
- [x] No timer fires after its test has ended (an armed timer at test end is cleared, proven by a test).
- [x] The backend test count is the same as before. (No existing test was removed or merged; 10 new tests were added — 7 for the registry on both schedulers, 3 for the harness timer controls and end-of-test cleanup.)

## Comments

Implemented in the commit titled `test(backend): gateway specs fire phase timers on demand` (see git history for the hash).

- `TimerScheduler` (`arm(key, dueAt, onExpire)` / `clear(key)`) is injected into `QuestionLockTimerRegistry`; default is the real-timer scheduler. The gateway takes an optional `PHASE_TIMER_SCHEDULERS` token that only the harness provides.
- Harness: `game.timers(joinCode?)` returns `{ lock, kahoot }`, each with `isArmed()`, `dueAt()` and `fireNow()` (awaits the expiry handler, then `settled()`).
- `session-write.spec.ts` and `session-room-scoping.spec.ts` also relied on the real lock timer (a 1s grace and a private-field read) and moved to the same calls.
- After a restart the lock deadline is recomputed from the stored phase start, so its due time matches the original only to within a few ms; the spec asserts that, not exact equality. The kahoot deadline is exact.
- Each of the four specs runs in about 1s on its own.
