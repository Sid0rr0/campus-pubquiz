/** Thrown by updateSessionSettings when the admin tries to change settings outside the lobby. */
export class SessionSettingsUpdateBlockedError extends Error {
  constructor(joinCode: string, reason: string) {
    super(`Cannot update settings for session "${joinCode}": ${reason}`);
    this.name = 'SessionSettingsUpdateBlockedError';
  }
}
