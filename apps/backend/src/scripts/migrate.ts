import 'dotenv/config';
import { MikroORM } from '@mikro-orm/postgresql';
import config from '@/mikro-orm.config';

async function runMigrations(): Promise<void> {
  const orm = await MikroORM.init(config);
  try {
    await orm.migrator.up();
  } finally {
    await orm.close(true);
  }
}

runMigrations().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
