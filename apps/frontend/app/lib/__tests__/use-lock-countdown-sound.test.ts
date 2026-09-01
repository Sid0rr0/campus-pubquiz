import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';

// jsdom implements HTMLMediaElement.play/pause as stubs that throw
// "not implemented" — stub them so the hook's calls resolve instead.
let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  playSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  pauseSpy = vi
    .spyOn(window.HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLockCountdownSound', () => {
  it('starts from offset 0 when the full 60s lock duration remains', () => {
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 60_000, enabled: true }),
    );

    act(() => result.current.unlock());

    // unlock() primes a separate throwaway element first (contexts[0]) so
    // its priming pause can never race with real playback — the real
    // countdown element is always the most recent play() call.
    const audio = playSpy.mock.contexts.at(-1) as HTMLAudioElement;
    expect(audio.currentTime).toBeCloseTo(0, 0);
  });

  it('starts partway through when a shorter lock duration remains', () => {
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 20_000, enabled: true }),
    );

    act(() => result.current.unlock());

    const audio = playSpy.mock.contexts.at(-1) as HTMLAudioElement;
    expect(audio.currentTime).toBeCloseTo(40, 0);
  });

  it('stops playback and resets position once the lock deadline clears', () => {
    const { result, rerender } = renderHook(
      ({ lockAt }: { lockAt: number | null }) =>
        useLockCountdownSound({ lockAt, enabled: true }),
      { initialProps: { lockAt: 30_000 as number | null } },
    );

    act(() => result.current.unlock());
    expect(pauseSpy).not.toHaveBeenCalled();

    rerender({ lockAt: null });

    expect(pauseSpy).toHaveBeenCalled();
    const audio = playSpy.mock.contexts.at(-1) as HTMLAudioElement;
    expect(audio.currentTime).toBe(0);
  });

  it('does not let a late-resolving priming pause cut off real playback that started in the meantime', async () => {
    // Regression test: unlock() used to prime the same element the real
    // countdown plays through, so if its priming promise resolved after
    // real playback had already started, the chained .then(pause) would
    // silently cut the countdown sound off. Simulate that ordering here by
    // holding the first (priming) play() call's promise open while a
    // second (real) play() call happens, then resolving it late.
    let resolvePriming: () => void = () => {};
    const primingPromise = new Promise<void>((resolve) => {
      resolvePriming = resolve;
    });
    let playCallCount = 0;
    playSpy.mockImplementation(() => {
      playCallCount += 1;
      return playCallCount === 1 ? primingPromise : Promise.resolve();
    });

    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 30_000, enabled: true }),
    );

    act(() => result.current.unlock());
    // The real countdown's play() (second call) already fired while the
    // priming promise from the first call is still unresolved.
    expect(playCallCount).toBe(2);
    expect(pauseSpy).not.toHaveBeenCalled();
    const realAudio = playSpy.mock.contexts[1];

    await act(async () => {
      resolvePriming();
      await primingPromise;
    });

    // The priming pause fires (on the throwaway primer) — but it must be a
    // different element than the one the real countdown played through.
    // Under the old shared-element implementation this pause call's `this`
    // would be realAudio itself, silently cutting the countdown off.
    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy.mock.contexts[0]).not.toBe(realAudio);
  });

  it('never plays the countdown before unlock() is called', () => {
    renderHook(() => useLockCountdownSound({ lockAt: 10_000, enabled: true }));

    expect(playSpy).not.toHaveBeenCalled();
  });

  it('stops and never resumes the countdown sound once disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useLockCountdownSound({ lockAt: 10_000, enabled }),
      { initialProps: { enabled: true } },
    );

    act(() => result.current.unlock());
    const callsAfterUnlock = playSpy.mock.calls.length;
    expect(callsAfterUnlock).toBeGreaterThan(0);

    rerender({ enabled: false });

    expect(pauseSpy).toHaveBeenCalled();
    expect(playSpy.mock.calls.length).toBe(callsAfterUnlock);
  });
});
