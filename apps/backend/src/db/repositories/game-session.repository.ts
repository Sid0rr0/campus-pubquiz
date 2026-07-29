import { EntityRepository } from '@mikro-orm/postgresql';
import type { GameSession } from '@/db/entities/game-session.entity';

export class GameSessionRepository extends EntityRepository<GameSession> {}
