import { EntityRepository } from '@mikro-orm/postgresql';
import type { Question } from '@/db/entities/question.entity';

export class QuestionRepository extends EntityRepository<Question> {}
