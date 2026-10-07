/**
 * Per-join-code, in-memory queue behind the Live session module's session
 * write: a task starts only once the previous task for the same join code has
 * finished (resolved or thrown). Tasks for other join codes don't wait. In
 * memory on purpose — one backend instance (see CLAUDE.md).
 */
export class SessionWriteQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(joinCode: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(joinCode) ?? Promise.resolve();
    // A failed task still passes the turn on; its caller gets the error below.
    const result = previous.then(task, task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(joinCode, tail);
    void tail.then(() => {
      if (this.tails.get(joinCode) === tail) this.tails.delete(joinCode);
    });
    return result;
  }

  /**
   * Runs `task` while holding the queues of every join code in `joinCodes`:
   * it waits for each one's earlier writes and blocks their later writes until
   * `task` finishes. Codes are taken in sorted order so overlapping holds
   * can't deadlock; other join codes are unaffected. A throwing task releases
   * every queue and its error reaches the caller, as with `run`.
   */
  async hold<T>(
    joinCodes: readonly string[],
    task: () => Promise<T>,
  ): Promise<T> {
    const sorted = [...new Set(joinCodes)].sort();
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    // Every queue is claimed in this tick, so no write can slip in between.
    const claims = sorted.map(
      (joinCode) =>
        new Promise<void>((arrived) => {
          void this.run(joinCode, () => {
            arrived();
            return released;
          });
        }),
    );
    try {
      await Promise.all(claims);
      return await task();
    } finally {
      release();
    }
  }

  /**
   * Resolves once every write queued for `joinCode` — and any write those
   * writes queue — has finished, whether it stored, was refused or threw.
   * Read-only: it only watches the tail and never changes the order.
   */
  async idle(joinCode: string): Promise<void> {
    for (let tail = this.tails.get(joinCode); tail; ) {
      await tail;
      // The tail clears its own entry first; a different one is a newer write.
      const next = this.tails.get(joinCode);
      tail = next === tail ? undefined : next;
    }
  }
}
