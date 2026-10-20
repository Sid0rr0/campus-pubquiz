import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

export default defineConfig({
  clientUrl:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/campus_pubquiz',
  driverOptions:
    process.env.NODE_ENV === 'production'
      ? { connection: { ssl: { rejectUnauthorized: false } } }
      : undefined,
  entities: ['./dist/db/entities/*.entity.js'],
  entitiesTs: ['./src/db/entities/*.entity.ts'],
  metadataProvider: TsMorphMetadataProvider,
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
    tableName: 'mikro_orm_migrations',
    // One snapshot for every database (the default name embeds the database
    // name). Only `migration:create` should write it: `migration:up` rewrites it
    // from the live database, whose normalised check and default text then
    // shows up as noise in the next migration. So every migrate path runs with
    // the snapshot off (`db:migrate`, `scripts/migrate.ts`, the Jest set-up).
    snapshotName: '.snapshot',
  },
  debug: process.env.NODE_ENV !== 'production',
});
