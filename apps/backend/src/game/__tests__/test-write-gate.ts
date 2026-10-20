import type { WriteGate, WriteStep } from '@/game/state/write-gate';

export interface GateFilter {
  /** Only a write for this join code is caught; any join code when omitted. */
  joinCode?: string;
}

/** A write held at a step of the Session write. */
export interface HeldWrite {
  /** Resolves once a write has reached the step and is stopped there. */
  reached: Promise<void>;
  /** Lets the held write carry on exactly where it stopped. */
  release: () => void;
}

interface Hold {
  step: WriteStep;
  joinCode?: string;
  description: string;
  isReached: boolean;
  markReached: () => void;
  released: Promise<void>;
  release: () => void;
}

interface QueuedWaiter {
  joinCode?: string;
  resolve: () => void;
}

/**
 * The Write gate the real-store harness gives the Session write: holds the next
 * write to reach a step, and tells a spec when the next write has been handed
 * over. Built per test module; `finish` runs at test end.
 */
export class TestWriteGate implements WriteGate {
  private readonly holds: Hold[] = [];
  private readonly waiters: QueuedWaiter[] = [];

  queued(joinCode: string): void {
    const index = this.waiters.findIndex(
      (waiter) => waiter.joinCode === undefined || waiter.joinCode === joinCode,
    );
    if (index === -1) return;
    const [waiter] = this.waiters.splice(index, 1);
    waiter.resolve();
  }

  async reached(step: WriteStep, joinCode: string): Promise<void> {
    const hold = this.holds.find(
      (candidate) =>
        !candidate.isReached &&
        candidate.step === step &&
        (candidate.joinCode === undefined || candidate.joinCode === joinCode),
    );
    if (!hold) return;
    hold.markReached();
    await hold.released;
  }

  holdAt(step: WriteStep, filter: GateFilter = {}): HeldWrite {
    let markReached!: () => void;
    const reached = new Promise<void>((resolve) => (markReached = resolve));
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const joinCode = filter.joinCode;
    const hold: Hold = {
      step,
      joinCode,
      description: joinCode ? `${step} (join code ${joinCode})` : step,
      isReached: false,
      markReached: () => {
        hold.isReached = true;
        markReached();
      },
      released,
      release,
    };
    this.holds.push(hold);
    return { reached, release };
  }

  nextQueued(filter: GateFilter = {}): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiters.push({ joinCode: filter.joinCode, resolve });
    });
  }

  /** Releases every outstanding hold; returns a message when a hold was never reached. */
  finish(): string | undefined {
    const unreached = this.holds.filter((hold) => !hold.isReached);
    for (const hold of this.holds) hold.release();
    this.holds.length = 0;
    this.waiters.length = 0;
    if (unreached.length === 0) return undefined;
    return `holdAt was never reached: ${unreached
      .map((hold) => hold.description)
      .join(
        ', ',
      )}. No write got to that step (does that kind of write skip it?).`;
  }
}
