import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import {
  EntityManager as CoreEntityManager,
  MikroORM as CoreMikroORM,
  MetadataStorage,
} from '@mikro-orm/core';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { DB_ENTITIES } from '@/db/db.module';

/** The class token comes from the entity's custom repository, when it has one. */
function repositoryProviders(): Provider[] {
  const metadata = Object.values(MetadataStorage.getMetadata());
  return DB_ENTITIES.flatMap((entity) => {
    const customRepository = metadata.find(
      (meta) => meta.class === entity,
    )?.repository;
    const tokens = [
      getRepositoryToken(entity),
      ...(customRepository ? [customRepository()] : []),
    ];
    return tokens.map(
      (token): Provider => ({
        provide: token,
        useFactory: (em: EntityManager): unknown => em.getRepository(entity),
        inject: [EntityManager],
      }),
    );
  });
}

/**
 * A test-only global Nest module over a spec's own ORM (from
 * `useTestDatabase`): the ORM, its entity manager and a repository for every
 * entity the app's database module registers.
 *
 * It deliberately does not use `MikroOrmModule`: that module closes the ORM it
 * registered when it shuts down, and closing a compiled test module must leave
 * the worker's connection open for the next spec file. These providers only
 * hand out values; nothing here owns the ORM, so nothing here closes it.
 */
export function createTestDatabaseModule(orm: MikroORM): DynamicModule {
  const values: Provider[] = [
    { provide: MikroORM, useValue: orm },
    { provide: CoreMikroORM, useValue: orm },
    { provide: EntityManager, useValue: orm.em },
    { provide: CoreEntityManager, useValue: orm.em },
  ];
  const providers = [...values, ...repositoryProviders()];

  @Global()
  @Module({
    providers,
    exports: providers.map((provider) =>
      'provide' in provider ? provider.provide : provider,
    ),
  })
  class TestDatabaseModule {}

  return { module: TestDatabaseModule };
}
