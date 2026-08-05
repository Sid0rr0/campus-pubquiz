import { Entity, Enum, OptionalProps, Property } from '@mikro-orm/core';
import type { UserRole, UserStatus } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { UserRepository } from '@/db/repositories/user.repository';

@Entity({ tableName: 'users', repository: () => UserRepository })
export class User extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'role' | 'status';

  @Property({ type: 'text', unique: true })
  username!: string;

  @Property({ type: 'text' })
  passwordHash!: string;

  @Enum({ items: () => ['admin', 'moderator'], default: 'moderator' })
  role!: UserRole;

  @Enum({
    items: () => ['pending', 'active', 'deactivated'],
    default: 'pending',
  })
  status!: UserStatus;
}
