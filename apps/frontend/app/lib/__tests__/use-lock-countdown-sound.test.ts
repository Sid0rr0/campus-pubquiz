import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { displaySounds } from '@/app/lib/display-sounds';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';

// The specs assert on the hook's HTMLMediaElement play/pause calls (offset,
// pause on disable), so spy on them; the stubbed `play` also resolves
// immediately instead of attempting real media playback.
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

  it('measures the time left against the current clock', () => {
    vi.setSystemTime(10_000);
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 40_000, enabled: true }),
    );

    act(() => result.current.unlock());

    const audio = playSpy.mock.contexts.at(-1) as HTMLAudioElement;
    expect(audio.currentTime).toBeCloseTo(30, 0);
  });

  it('plays the lock countdown track, both to prime and to count down', () => {
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 30_000, enabled: true }),
    );

    act(() => result.current.unlock());

    expect(playSpy.mock.contexts).toHaveLength(2);
    for (const context of playSpy.mock.contexts) {
      expect((context as HTMLAudioElement).getAttribute('src')).toBe(
        '/sounds/lock-countdown.mp3',
      );
    }
  });

  it('unlocks the display sound registry from the same gesture', () => {
    const unlockSpy = vi.spyOn(displaySounds, 'unlock');
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: null, enabled: false }),
    );

    act(() => result.current.unlock());

    expect(unlockSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses one audio element for every play of the countdown', () => {
    const { result, rerender } = renderHook(
      ({ isMuted }: { isMuted: boolean }) =>
        useLockCountdownSound({ lockAt: 30_000, enabled: true, isMuted }),
      { initialProps: { isMuted: false } },
    );
    act(() => result.current.unlock());
    const first = playSpy.mock.contexts.at(-1);

    rerender({ isMuted: true });
    rerender({ isMuted: false });

    expect(playSpy.mock.contexts.at(-1)).toBe(first);
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

  it('never plays the countdown while the display sound is muted', () => {
    const { result } = renderHook(() =>
      useLockCountdownSound({ lockAt: 10_000, enabled: true, isMuted: true }),
    );

    act(() => result.current.unlock());

    // Only the unlock primer plays; the countdown element never starts.
    expect(playSpy.mock.calls.length).toBe(1);
  });

  it('stops the countdown when muted mid-lock and resumes on unmute', () => {
    const { result, rerender } = renderHook(
      ({ isMuted }: { isMuted: boolean }) =>
        useLockCountdownSound({ lockAt: 30_000, enabled: true, isMuted }),
      { initialProps: { isMuted: false } },
    );
    act(() => result.current.unlock());
    const callsAfterUnlock = playSpy.mock.calls.length;

    rerender({ isMuted: true });
    expect(pauseSpy).toHaveBeenCalled();
    expect(playSpy.mock.calls.length).toBe(callsAfterUnlock);

    rerender({ isMuted: false });
    expect(playSpy.mock.calls.length).toBe(callsAfterUnlock + 1);
  });

  describe('needsUnlock', () => {
    it('is false when the setting is off and the registry is not in use', () => {
      const { result } = renderHook(() =>
        useLockCountdownSound({ lockAt: null, enabled: false }),
      );
      expect(result.current.needsUnlock).toBe(false);
    });

    it('is true when the setting is off but the registry is in use', () => {
      const { result } = renderHook(() =>
        useLockCountdownSound({
          lockAt: null,
          enabled: false,
          isRegistryInUse: true,
        }),
      );
      expect(result.current.needsUnlock).toBe(true);
    });

    it('is false once unlocked, and while muted', () => {
      const unlocked = renderHook(() =>
        useLockCountdownSound({
          lockAt: null,
          enabled: false,
          isRegistryInUse: true,
        }),
      );
      act(() => unlocked.result.current.unlock());
      expect(unlocked.result.current.needsUnlock).toBe(false);

      const muted = renderHook(() =>
        useLockCountdownSound({
          lockAt: null,
          enabled: true,
          isRegistryInUse: true,
          isMuted: true,
        }),
      );
      expect(muted.result.current.needsUnlock).toBe(false);
    });
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
