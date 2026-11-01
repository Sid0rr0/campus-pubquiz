import { EntityRepository } from '@mikro-orm/postgresql';
import type { Purchase } from '@/db/entities/purchase.entity';

export class PurchaseRepository extends EntityRepository<Purchase> {}
