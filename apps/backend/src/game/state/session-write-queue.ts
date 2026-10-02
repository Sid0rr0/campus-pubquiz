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
