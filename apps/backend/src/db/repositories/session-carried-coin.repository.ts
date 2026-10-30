import { EntityRepository } from '@mikro-orm/postgresql';
import type { SessionCarriedCoin } from '@/db/entities/session-carried-coin.entity';

export class SessionCarriedCoinRepository extends EntityRepository<SessionCarriedCoin> {}
