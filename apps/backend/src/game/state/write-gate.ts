/** Injection token for the Session write's Write gate; nothing provides it in production, so writes use the pass-through gate. */
export const WRITE_GATE = Symbol('WRITE_GATE');

/**
 * The named steps of a Session write a Write gate is told about:
 * - `hold`: a Live edit hold owns all its queues and is about to run its task (once per join code in the hold).
 * - `change`: a write's change has returned and nothing has been stored yet (queued and held writes alike).
 * - `standings`: just before the live results read; a write that opts out of the standings read never reaches it.
 */
export type WriteStep = 'hold' | 'change' | 'standings';

/**
 * What the Session write reports to as it works. In production it passes
 * straight through; the real-store harness swaps in a test gate that can hold
 * a write at a step, so a spec forces two writes to overlap without knowing
 * which collaborator the first one awaits.
 */
export interface WriteGate {
  /** A write (queued, held or a close) has been handed over for this join code. Synchronous. */
  queued(joinCode: string): void;
  /** A write reached `step`; the Session write awaits this before carrying on. */
  reached(step: WriteStep, joinCode: string): Promise<void>;
}

export const PASS_THROUGH_WRITE_GATE: WriteGate = {
  queued: () => undefined,
  reached: () => Promise.resolve(),
};
