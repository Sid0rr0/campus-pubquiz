import { EntityRepository } from '@mikro-orm/postgresql';
import type { GameSessionTeam } from '@/db/entities/game-session-team.entity';

export class GameSessionTeamRepository extends EntityRepository<GameSessionTeam> {}
