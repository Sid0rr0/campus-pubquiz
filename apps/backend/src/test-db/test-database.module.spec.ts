import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager as CoreEntityManager } from '@mikro-orm/core';
import { EntityManager, MikroORM, RequestContext } from '@mikro-orm/postgresql';
import { Quiz } from '@/db/entities/quiz.entity';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { useTestDatabase } from '@/test-db/test-database';
import { createTestDatabaseModule } from '@/test-db/test-database.module';

@Injectable()
class QuizWriter {
  constructor(
    @Inject(getRepositoryToken(Quiz)) private readonly quizzes: QuizRepository,
  ) {}

  /** Like a gateway handler: the global entity manager forks per request context. */
  save(title: string): Promise<void> {
    return RequestContext.create(this.quizzes.getEntityManager(), async () => {
      this.quizzes.getEntityManager().create(Quiz, { title });
      await this.quizzes.getEntityManager().flush();
    });
  }

  titles(): Promise<string[]> {
    return RequestContext.create(this.quizzes.getEntityManager(), async () => {
      const rows = await this.quizzes.findAll();
      return rows.map((quiz) => quiz.title);
    });
  }
}

describe('test database Nest module', () => {
  const db = useTestDatabase();

  async function compile() {
    @Module({ providers: [QuizWriter] })
    class WriterModule {}
    return Test.createTestingModule({
      imports: [createTestDatabaseModule(db.orm), WriterModule],
    }).compile();
  }

  it('lets a provider write and read a row through an injected repository', async () => {
    const moduleRef = await compile();

    const writer = moduleRef.get(QuizWriter);
    await writer.save('Written through Nest');

    expect(await writer.titles()).toEqual(['Written through Nest']);
    await moduleRef.close();
  });

  it('provides the worker ORM, its entity manager and the class-token repository', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(MikroORM)).toBe(db.orm);
    expect(moduleRef.get(EntityManager)).toBe(db.orm.em);
    expect(moduleRef.get(CoreEntityManager)).toBe(db.orm.em);
    expect(moduleRef.get(QuizRepository)).toBeInstanceOf(QuizRepository);
    await moduleRef.close();
  });

  it('leaves the worker ORM connected after the module closes', async () => {
    const moduleRef = await compile();
    await moduleRef.get(QuizWriter).save('Before close');

    await moduleRef.close();

    expect(await db.orm.isConnected()).toBe(true);
    expect(await db.orm.em.fork().count(Quiz)).toBe(1);
  });

  it('keeps the worker ORM usable by a second module after the first closed', async () => {
    const first = await compile();
    await first.close();

    const second = await compile();
    await second.get(QuizWriter).save('Second module');

    expect(await second.get(QuizWriter).titles()).toEqual(['Second module']);
    await second.close();
  });

  it('starts every test with the rows from earlier tests emptied', async () => {
    const moduleRef = await compile();

    expect(await moduleRef.get(QuizWriter).titles()).toEqual([]);
    await moduleRef.close();
  });
});
