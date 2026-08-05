import { EntityRepository } from '@mikro-orm/postgresql';
import { Session } from '@/db/entities/session.entity';

export class SessionRepository extends EntityRepository<Session> {}
