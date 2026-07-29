import { Entity, PrimaryKey } from '@mikro-orm/core';
import { TimestampedEntity } from './timestamped.entity';

@Entity({ abstract: true })
export abstract class BaseEntity extends TimestampedEntity {
  @PrimaryKey()
  id!: number;
}
