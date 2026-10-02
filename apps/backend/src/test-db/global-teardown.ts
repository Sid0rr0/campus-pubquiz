import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>)
    .__TEST_POSTGRES_CONTAINER__ as StartedPostgreSqlContainer | undefined;
  await container?.stop();
}
