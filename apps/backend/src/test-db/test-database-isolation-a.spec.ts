import { Quiz } from '@/db/entities/quiz.entity';
import { useTestDatabase } from '@/test-db/test-database';

// Twin of test-database-isolation-{a,b}.spec.ts: whichever runs second on a
// worker would see the other's row if the tables weren't emptied between files.
describe('test database isolation across spec files', () => {
  const db = useTestDatabase();

  it('sees no rows left by another spec file, then leaves one behind', async () => {
    const em = db.orm.em.fork();
    expect(await em.count(Quiz)).toBe(0);
    em.create(Quiz, { title: 'Left behind by a spec file' });
    await em.flush();
  });
});
