import { ManualTimerScheduler } from '@/game/__tests__/manual-timer-scheduler';
import {
  createRealTimerScheduler,
  QuestionLockTimerRegistry,
} from '@/game/socket/question-lock-timer.registry';

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

  describe('clearAll forgets sessions that no longer have a timer', () => {
    it('skips a session whose timer already fired', async () => {
      registry.rearm('AAAA', SOON, jest.fn());
      await scheduler.fire('AAAA');
      const clear = jest.spyOn(scheduler, 'clear');

      registry.clearAll();

      expect(clear).not.toHaveBeenCalled();
    });

    it('skips a session that was re-armed with null', () => {
      registry.rearm('AAAA', SOON, jest.fn());
      registry.rearm('AAAA', null, jest.fn());
      const clear = jest.spyOn(scheduler, 'clear');

      registry.clearAll();

      expect(clear).not.toHaveBeenCalled();
    });

    it('skips sessions it already cleared on an earlier clearAll', () => {
      registry.rearm('AAAA', SOON, jest.fn());
      registry.clearAll();
      const clear = jest.spyOn(scheduler, 'clear');

      registry.clearAll();

      expect(clear).not.toHaveBeenCalled();
    });

    it('clears each armed session exactly once', () => {
      registry.rearm('AAAA', SOON, jest.fn());
      registry.rearm('BBBB', LATER, jest.fn());
      const clear = jest.spyOn(scheduler, 'clear');

      registry.clearAll();

      expect(clear.mock.calls).toEqual([['AAAA'], ['BBBB']]);
    });
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

  it('the real scheduler replaces a key’s deadline when armed again, whatever the caller does', () => {
    const scheduler = createRealTimerScheduler();
    const first = jest.fn();
    const second = jest.fn();

    scheduler.arm('AAAA', Date.now() + 1_000, first);
    scheduler.arm('AAAA', Date.now() + 2_000, second);
    jest.advanceTimersByTime(2_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancels the earlier deadline when a session is re-armed, and can be armed again after firing', () => {
    const registry = new QuestionLockTimerRegistry();
    const first = jest.fn();
    const second = jest.fn();
    const third = jest.fn();

    registry.rearm('AAAA', Date.now() + 1_000, first);
    registry.rearm('AAAA', Date.now() + 2_000, second);
    jest.advanceTimersByTime(2_000);
    registry.rearm('AAAA', Date.now() + 1_000, third);
    jest.advanceTimersByTime(1_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
  });
});
