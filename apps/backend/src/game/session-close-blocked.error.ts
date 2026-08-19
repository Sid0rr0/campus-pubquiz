/** Thrown by closeSession when a joinCode can't be evicted from the in-memory map yet. */
export class SessionCloseBlockedError extends Error {
  constructor(joinCode: string, reason: string) {
    super(`Cannot close session "${joinCode}": ${reason}`);
    this.name = 'SessionCloseBlockedError';
  }
}
