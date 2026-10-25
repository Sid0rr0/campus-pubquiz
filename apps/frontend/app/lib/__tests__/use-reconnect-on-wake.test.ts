import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HIDDEN_RECONNECT_THRESHOLD_MS,
  useReconnectOnWake,
} from '@/app/lib/use-reconnect-on-wake';

// jsdom's PageTransitionEvent drops `persisted`, so the flag is set by hand.
function pageShow(persisted: boolean) {
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useReconnectOnWake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects once when the page becomes visible after being hidden for the threshold', () => {
    const onWake = vi.fn();
    renderHook(() => useReconnectOnWake(onWake));

    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_RECONNECT_THRESHOLD_MS);
    setVisibility('visible');

    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the page was hidden for less than the threshold', () => {
    const onWake = vi.fn();
    renderHook(() => useReconnectOnWake(onWake));

    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_RECONNECT_THRESHOLD_MS - 1);
    setVisibility('visible');

    expect(onWake).not.toHaveBeenCalled();
  });

  it('reconnects on pageshow restored from the back/forward cache, not on a normal pageshow', () => {
    const onWake = vi.fn();
    renderHook(() => useReconnectOnWake(onWake));

    pageShow(false);
    expect(onWake).not.toHaveBeenCalled();

    pageShow(true);
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('reconnects when the network comes back', () => {
    const onWake = vi.fn();
    renderHook(() => useReconnectOnWake(onWake));

    window.dispatchEvent(new Event('online'));

    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('calls the latest onWake, not the one from the first render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onWake }: { onWake: () => void }) => useReconnectOnWake(onWake),
      { initialProps: { onWake: first } },
    );

    rerender({ onWake: second });
    window.dispatchEvent(new Event('online'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes its listeners on unmount', () => {
    const onWake = vi.fn();
    const { unmount } = renderHook(() => useReconnectOnWake(onWake));
    unmount();

    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_RECONNECT_THRESHOLD_MS);
    setVisibility('visible');
    pageShow(true);
    window.dispatchEvent(new Event('online'));

    expect(onWake).not.toHaveBeenCalled();
  });
});
