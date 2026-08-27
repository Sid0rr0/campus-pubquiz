import { EntityRepository } from '@mikro-orm/postgresql';
import type { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';

export class ShowdownRoundTeamRepository extends EntityRepository<ShowdownRoundTeam> {}
