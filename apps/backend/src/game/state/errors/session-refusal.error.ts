/**
 * Thrown by the Live session module when an event isn't allowed right now.
 * Its message is the one the sender sees; the guarded event dispatcher turns
 * it into a socket error, so handlers never wrap it themselves.
 */
export class SessionRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRefusal';
  }
}
