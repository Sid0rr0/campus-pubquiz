import { SessionRefusal } from '@/game/state/errors/session-refusal.error';

/**
 * A bonus edit or deletion named an award that doesn't exist, or belongs to
 * another session. Its own type so the REST entry can answer it as "not found"
 * rather than as an invalid award.
 */
export class BonusAwardNotFoundRefusal extends SessionRefusal {
  constructor(message: string) {
    super(message);
    this.name = 'BonusAwardNotFoundRefusal';
  }
}
