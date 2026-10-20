import { EntityRepository } from '@mikro-orm/postgresql';
import type { League } from '@/db/entities/league.entity';

export class LeagueRepository extends EntityRepository<League> {}
