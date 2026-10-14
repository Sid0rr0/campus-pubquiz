import { afterEach, describe, expect, it, vi } from 'vitest';
import { vibrate } from '@/app/lib/vibrate';

const originalVibrate = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'vibrate',
);

afterEach(() => {
  if (originalVibrate) {
    Object.defineProperty(Navigator.prototype, 'vibrate', originalVibrate);
  } else {
    Reflect.deleteProperty(Navigator.prototype, 'vibrate');
  }
});

describe('vibrate', () => {
  it('does nothing when navigator.vibrate is missing', () => {
    Reflect.deleteProperty(Navigator.prototype, 'vibrate');

    expect(() => vibrate('success')).not.toThrow();
  });

  it('calls navigator.vibrate with the pattern when supported', () => {
    const spy = vi.fn().mockReturnValue(true);
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      value: spy,
      configurable: true,
      writable: true,
    });

    vibrate('success');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(expect.anything());
  });
});
