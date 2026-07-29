import { Entity, OptionalProps, Property } from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { TeamRepository } from '@/db/repositories/team.repository';

@Entity({ tableName: 'teams', repository: () => TeamRepository })
export class Team extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @Property({ type: 'text', unique: true })
  name!: string;

  // Opaque reconnect credential generated on first join and stored in the
  // browser's localStorage — proves "this device is this team" across page
  // refreshes without requiring the join code again.
  @Property({ type: 'text', unique: true })
  token!: string;

  // Human-enterable recovery code, shown to the team once. Lets a second
  // device join under this team's existing name without its localStorage
  // token (e.g. a teammate's phone, or the original device lost state).
  @Property({ type: 'text' })
  code!: string;
}
