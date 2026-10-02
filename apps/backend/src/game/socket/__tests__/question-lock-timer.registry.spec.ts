import { ManualTimerScheduler } from '@/game/__tests__/manual-timer-scheduler';
import { QuestionLockTimerRegistry } from '@/game/socket/question-lock-timer.registry';

const SOON = 5_000;
const LATER = 9_000;

describe('QuestionLockTimerRegistry on a manual scheduler', () => {
  let scheduler: ManualTimerScheduler;
  let registry: QuestionLockTimerRegistry;

  beforeEach(() => {
    scheduler = new ManualTimerScheduler();
    registry = new QuestionLockTimerRegistry(scheduler);
  });

  it('replaces the earlier timer when a session is re-armed', async () => {
    const first = jest.fn();
    const second = jest.fn();

    registry.rearm('AAAA', SOON, first);
    registry.rearm('AAAA', LATER, second);
    await scheduler.fire('AAAA');

    expect(scheduler.dueAt('AAAA')).toBeNull();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing armed after arming with null', () => {
    registry.rearm('AAAA', SOON, jest.fn());

    registry.rearm('AAAA', null, jest.fn());

    expect(scheduler.isArmed('AAAA')).toBe(false);
  });

  it('leaves nothing armed after clearAll', () => {
    registry.rearm('AAAA', SOON, jest.fn());
    registry.rearm('BBBB', LATER, jest.fn());

    registry.clearAll();

    expect(scheduler.isArmed('AAAA')).toBe(false);
    expect(scheduler.isArmed('BBBB')).toBe(false);
  });

  it('runs the expiry exactly once, and arms nothing afterwards', async () => {
    const onExpire = jest.fn();
    registry.rearm('AAAA', SOON, onExpire);

    await scheduler.fire('AAAA');

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(scheduler.isArmed('AAAA')).toBe(false);
    await expect(scheduler.fire('AAAA')).rejects.toThrow('No timer is armed');
  });

  it('reports the exact deadline it was armed with', () => {
    registry.rearm('AAAA', SOON, jest.fn());

    expect(scheduler.dueAt('AAAA')).toBe(SOON);
  });

  it("leaves another session's timer untouched", async () => {
    const other = jest.fn();
    registry.rearm('AAAA', SOON, jest.fn());
    registry.rearm('BBBB', LATER, other);

    registry.rearm('AAAA', null, jest.fn());
    await scheduler.fire('BBBB');

    expect(scheduler.isArmed('AAAA')).toBe(false);
    expect(other).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionLockTimerRegistry on real timers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires at the deadline, and not when cleared first', () => {
    const registry = new QuestionLockTimerRegistry();
    const fired = jest.fn();
    const cancelled = jest.fn();

    registry.rearm('AAAA', Date.now() + 1_000, fired);
    registry.rearm('BBBB', Date.now() + 1_000, cancelled);
    registry.rearm('BBBB', null, cancelled);
    jest.advanceTimersByTime(999);
    expect(fired).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(fired).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });
});
