/**
 * Arms and clears one deadline per key (a session's join code). Production
 * uses the real-timer scheduler below; the real-store test harness swaps in a
 * manual one so a spec can read a deadline and fire it without waiting.
 */
/** What runs when a timer expires; a scheduler may wait on the promise it returns. */
export type ExpiryCallback = () => void | Promise<void>;

export interface TimerScheduler {
  /** Runs `onExpire` once at `dueAt` (epoch-ms), replacing any deadline already armed for `key`. */
  arm(key: string, dueAt: number, onExpire: ExpiryCallback): void;
  /** Cancels the deadline armed for `key`, if any. */
  clear(key: string): void;
}

export function createRealTimerScheduler(): TimerScheduler {
  const timers = new Map<string, NodeJS.Timeout>();
  const clear = (key: string) => {
    clearTimeout(timers.get(key));
    timers.delete(key);
  };
  return {
    arm: (key, dueAt, onExpire) => {
      clear(key);
      timers.set(
        key,
        setTimeout(
          () => {
            timers.delete(key);
            void onExpire();
          },
          Math.max(0, dueAt - Date.now()),
        ),
      );
    },
    clear,
  };
}

/** Tracks one auto-lock timer per session, so arming a new one always clears any stale one first. */
export class QuestionLockTimerRegistry {
  private readonly armedKeys = new Set<string>();

  constructor(
    private readonly scheduler: TimerScheduler = createRealTimerScheduler(),
  ) {}

  /** (Re)arms this session's timer to fire `onExpire` at `lockAt` (epoch-ms), clearing any existing one first; `lockAt === null` just clears. */
  rearm(
    joinCode: string,
    lockAt: number | null,
    onExpire: ExpiryCallback,
  ): void {
    this.scheduler.clear(joinCode);
    this.armedKeys.delete(joinCode);
    if (lockAt === null) return;

    this.armedKeys.add(joinCode);
    this.scheduler.arm(joinCode, lockAt, () => {
      this.armedKeys.delete(joinCode);
      return onExpire();
    });
  }

  clearAll(): void {
    for (const joinCode of this.armedKeys) {
      this.scheduler.clear(joinCode);
    }
    this.armedKeys.clear();
  }
}
