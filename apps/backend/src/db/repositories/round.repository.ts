import { EntityRepository } from '@mikro-orm/postgresql';
import type { Round } from '@/db/entities/round.entity';

export class RoundRepository extends EntityRepository<Round> {}
