import { Entity, Property } from '@mikro-orm/core';

// Concrete subclasses each redeclare `[OptionalProps]` including at least
// 'createdAt' | 'updatedAt' (TS class-member overrides can't widen an
// inherited union, so it can't be declared once here and extended below) —
// tells MikroORM's em.create()/upsert() typings that these two are filled
// by the onCreate/onUpdate hooks, not required at construction time.
@Entity({ abstract: true })
export abstract class TimestampedEntity {
  @Property({ type: 'timestamptz', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt!: Date;
}
