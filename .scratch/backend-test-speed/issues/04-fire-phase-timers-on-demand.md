# 04: Gateway specs fire phase timers on demand

**What to build:** A gateway spec can see whether its session's lock timer or kahoot question timer is armed, read when it's due, and make it fire immediately. The fired timer runs the same expiry path production runs. "Auto-locks when the timer elapses", "auto-advances the kahoot question" and "doesn't arm a timer when the setting is null" then run in milliseconds, instead of arming real 1s timers, polling for up to 10s and waiting out 2.5s quiet periods.

The question lock timer registry takes an optional scheduler (an arm and clear pair). Its default is the real `setTimeout`/`clearTimeout`, so production behaviour is unchanged. The gateway builds its lock and kahoot registries with the default unless the real-store harness provides a manual scheduler. The harness exposes, per game handle and for each of the two timers: whether one is armed, its due time (epoch ms), and a fire-now call that runs the expiry and then waits for `settled()`. The harness clears every armed timer when a test ends, so nothing fires into the next test's tables.

The question lock auto-advance, lock-timer isolation, kahoot question auto-advance and outcome-delivery-and-timers specs switch to these calls. Their test names and their assertions about what each room is sent stay the same. "Doesn't arm" and "re-arms on restart" become assertions on armed state and due time.

Jest fake timers are not used for this: the Postgres driver and MikroORM rely on real timers. `freezeClockAt` (which fakes only `Date`) stays as is.

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** 03 (Gateway specs wait for a settled session instead of sleeping), because fire-now waits for `settled()`.

**Status:** ready-for-agent

- [ ] Written first: with a manual scheduler, re-arming a session's timer replaces the earlier one; clearing leaves nothing armed; firing runs the expiry callback exactly once; another session's timer is untouched.
- [ ] The real scheduler path stays covered by the existing phase timer and lock-timer specs, which pass unchanged.
- [ ] The four timer specs use armed-state, due-time and fire-now calls, with no real-time polling, quiet periods or sleeps left.
- [ ] Each of the four specs takes under 3s on its own.
- [ ] No timer fires after its test has ended (an armed timer at test end is cleared, proven by a test).
- [ ] The backend test count is the same as before.
