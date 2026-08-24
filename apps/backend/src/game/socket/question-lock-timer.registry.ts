/** Tracks one auto-lock timer per session, so arming a new one always clears any stale one first. */
export class QuestionLockTimerRegistry {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  /** (Re)arms this session's timer to fire `onExpire` at `lockAt` (epoch-ms), clearing any existing one first; `lockAt === null` just clears. */
  rearm(joinCode: string, lockAt: number | null, onExpire: () => void): void {
    const existing = this.timers.get(joinCode);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(joinCode);
    }
    if (lockAt === null) return;

    const delay = Math.max(0, lockAt - Date.now());
    this.timers.set(
      joinCode,
      setTimeout(() => {
        this.timers.delete(joinCode);
        onExpire();
      }, delay),
    );
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
