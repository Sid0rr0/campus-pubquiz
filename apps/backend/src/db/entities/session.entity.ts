import { Entity, ManyToOne, OptionalProps, Property } from '@mikro-orm/core';
import { BaseEntity } from '@/db/entities/base.entity';
import { User } from '@/db/entities/user.entity';
import { SessionRepository } from '@/db/repositories/session.repository';

@Entity({ tableName: 'sessions', repository: () => SessionRepository })
export class Session extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => User)
  user!: User;

  // sha256 hex digest of the opaque session token — the raw token
  // (crypto.randomBytes(32).toString('hex')) is only ever held by the
  // client, carried in the httpOnly session cookie sent on both REST
  // requests and the Socket.IO handshake; only its hash is persisted, so a
  // DB leak doesn't hand out directly usable session credentials. Sliding
  // expiration: every successful validate() pushes expiresAt forward, so a
  // live event's continuous admin traffic never lapses mid-show.
  @Property({ type: 'text', unique: true })
  tokenHash!: string;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;
}
