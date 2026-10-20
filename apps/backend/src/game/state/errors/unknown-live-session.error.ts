/** A REST request named a join code with no live session: it never existed, or was closed while the request waited in the queue. */
export class UnknownLiveSessionError extends Error {
  constructor(readonly joinCode: string) {
    super(`Unknown session "${joinCode}"`);
    this.name = 'UnknownLiveSessionError';
  }
}
