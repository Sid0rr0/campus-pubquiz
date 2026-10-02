import type {
  ExpiryCallback,
  TimerScheduler,
} from '@/game/socket/question-lock-timer.registry';

interface ArmedTimer {
  dueAt: number;
  onExpire: ExpiryCallback;
}

/** A scheduler that never waits: a spec reads what is armed and fires it on demand. */
export class ManualTimerScheduler implements TimerScheduler {
  private readonly armed = new Map<string, ArmedTimer>();

  arm(key: string, dueAt: number, onExpire: ExpiryCallback): void {
    this.armed.set(key, { dueAt, onExpire });
  }

  clear(key: string): void {
    this.armed.delete(key);
  }

  isArmed(key: string): boolean {
    return this.armed.has(key);
  }

  /** Epoch-ms the timer for `key` is due, or null when none is armed. */
  dueAt(key: string): number | null {
    return this.armed.get(key)?.dueAt ?? null;
  }

  /** Runs the expiry for `key` once, as its real timer would, and disarms it; resolves when the expiry has finished. */
  async fire(key: string): Promise<void> {
    const timer = this.armed.get(key);
    if (!timer) throw new Error(`No timer is armed for "${key}"`);
    this.armed.delete(key);
    await timer.onExpire();
  }
}
