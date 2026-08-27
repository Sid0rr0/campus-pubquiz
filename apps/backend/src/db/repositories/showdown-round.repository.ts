import { EntityRepository } from '@mikro-orm/postgresql';
import type { ShowdownRound } from '@/db/entities/showdown-round.entity';

export class ShowdownRoundRepository extends EntityRepository<ShowdownRound> {}
