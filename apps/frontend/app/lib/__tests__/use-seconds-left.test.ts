import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatSecondsLeft, useSecondsLeft } from '@/app/lib/use-seconds-left';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSecondsLeft', () => {
  it('is null while there is no deadline', () => {
    const { result } = renderHook(() => useSecondsLeft(null));
    expect(result.current).toBeNull();
  });

  it('counts the whole seconds left, rounding up, and ticks down', () => {
    const { result } = renderHook(() => useSecondsLeft(10_500));
    expect(result.current).toBe(11);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(10);

    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(result.current).toBe(1);
  });

  it('stops at 0 once the deadline has passed', () => {
    const { result } = renderHook(() => useSecondsLeft(2_000));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(0);
  });

  it('shows the new time left at once when the deadline changes', () => {
    const { result, rerender } = renderHook(
      ({ endsAt }: { endsAt: number | null }) => useSecondsLeft(endsAt),
      { initialProps: { endsAt: 10_000 as number | null } },
    );
    expect(result.current).toBe(10);

    rerender({ endsAt: 30_000 });
    expect(result.current).toBe(30);
  });

  it('goes back to null when the deadline is cleared', () => {
    const { result, rerender } = renderHook(
      ({ endsAt }: { endsAt: number | null }) => useSecondsLeft(endsAt),
      { initialProps: { endsAt: 10_000 as number | null } },
    );
    expect(result.current).toBe(10);

    rerender({ endsAt: null });
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops ticking on unmount', () => {
    const { unmount } = renderHook(() => useSecondsLeft(10_000));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the running interval when the deadline changes', () => {
    const { rerender } = renderHook(
      ({ endsAt }: { endsAt: number }) => useSecondsLeft(endsAt),
      { initialProps: { endsAt: 10_000 } },
    );
    rerender({ endsAt: 20_000 });
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('formatSecondsLeft', () => {
  it('formats seconds as minutes:seconds with two-digit seconds', () => {
    expect(formatSecondsLeft(0)).toBe('0:00');
    expect(formatSecondsLeft(5)).toBe('0:05');
    expect(formatSecondsLeft(42)).toBe('0:42');
    expect(formatSecondsLeft(60)).toBe('1:00');
    expect(formatSecondsLeft(125)).toBe('2:05');
  });
});
