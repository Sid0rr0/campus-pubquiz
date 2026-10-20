import { EntityRepository } from '@mikro-orm/postgresql';
import type { LeagueSession } from '@/db/entities/league-session.entity';

export class LeagueSessionRepository extends EntityRepository<LeagueSession> {}
