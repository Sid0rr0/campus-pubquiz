import { EntityRepository } from '@mikro-orm/postgresql';
import type { Answer } from '@/db/entities/answer.entity';

export class AnswerRepository extends EntityRepository<Answer> {}
