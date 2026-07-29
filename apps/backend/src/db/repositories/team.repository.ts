import { EntityRepository } from '@mikro-orm/postgresql';
import type { Team } from '@/db/entities/team.entity';

export class TeamRepository extends EntityRepository<Team> {}
