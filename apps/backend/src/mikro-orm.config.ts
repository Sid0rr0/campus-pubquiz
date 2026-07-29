import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

export default defineConfig({
  clientUrl:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/campus_pubquiz',
  entities: ['./dist/db/entities/*.entity.js'],
  entitiesTs: ['./src/db/entities/*.entity.ts'],
  metadataProvider: TsMorphMetadataProvider,
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
    tableName: 'mikro_orm_migrations',
  },
  debug: process.env.NODE_ENV !== 'production',
});
