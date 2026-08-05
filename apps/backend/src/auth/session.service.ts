import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type { AuthUser } from '@campus-pubquiz/types';
import { Session } from '@/db/entities/session.entity';
import { User } from '@/db/entities/user.entity';
import { SessionRepository } from '@/db/repositories/session.repository';

// Sliding idle timeout: every successful validate() pushes expiresAt this far
// forward again, so a live event's continuous admin/moderator traffic never
// lapses mid-show. Generous on purpose — this is a low-infra, single-event
// app, not a high-security API.
export const SESSION_IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

export interface ValidatedSession {
  user: AuthUser;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
  };
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session) private readonly sessions: SessionRepository,
  ) {}

  async create(user: User): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const session = this.sessions.create({
      user,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_IDLE_TIMEOUT_MS),
    });
    await this.sessions.getEntityManager().persistAndFlush(session);
    return token;
  }

  async validate(token: string | undefined): Promise<ValidatedSession | null> {
    if (!token) return null;

    const session = await this.sessions.findOne(
      { tokenHash: hashToken(token) },
      { populate: ['user'] },
    );
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.status !== 'active') return null;

    session.expiresAt = new Date(Date.now() + SESSION_IDLE_TIMEOUT_MS);
    await this.sessions.getEntityManager().flush();

    return { user: toAuthUser(session.user) };
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.nativeDelete({ tokenHash: hashToken(token) });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.sessions.nativeDelete({ user: userId });
  }
}
