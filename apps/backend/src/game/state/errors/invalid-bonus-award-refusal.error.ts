import { SessionRefusal } from '@/game/state/errors/session-refusal.error';

/**
 * A bonus award or edit was invalid (zero points, a custom bonus with no
 * reason, a team outside the session). Its own type so the REST entry can turn
 * exactly this refusal back into the bonus service's invalid-award error and
 * let every other session refusal pass through.
 */
export class InvalidBonusAwardRefusal extends SessionRefusal {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBonusAwardRefusal';
  }
}
