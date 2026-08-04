import { EntityRepository } from '@mikro-orm/postgresql';
import type { BonusAward } from '@/db/entities/bonus-award.entity';

export class BonusAwardRepository extends EntityRepository<BonusAward> {}
