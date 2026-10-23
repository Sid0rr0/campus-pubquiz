/** Thrown by updateSessionSettings when the merged settings break a rule between two of them (Jokers on with the round overview off). */
export class SessionSettingsInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionSettingsInvalidError';
  }
}
