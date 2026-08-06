import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import * as bcrypt from 'bcryptjs';
import type {
  AuthUser,
  UserListItem,
  UserRole,
  UsersListedPayload,
} from '@campus-pubquiz/types';
import { User } from '@/db/entities/user.entity';
import { UserRepository } from '@/db/repositories/user.repository';
import { hashPassword } from '@/auth/password-hash';
import { SessionService, toAuthUser } from '@/auth/session.service';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountPendingError extends Error {
  constructor() {
    super('Your account is awaiting admin approval');
    this.name = 'AccountPendingError';
  }
}

export class AccountDeactivatedError extends Error {
  constructor() {
    super('Your account has been deactivated');
    this.name = 'AccountDeactivatedError';
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: number) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: UserRepository,
    private readonly sessions: SessionService,
  ) {}

  // Deliberately doesn't distinguish a taken username from a successful
  // registration in its return value or timing-sensitive control flow — the
  // login path already avoids leaking whether a username exists, and doing
  // the same here closes off username enumeration via the register endpoint.
  // The real admin, who already knows every registrant, is the actual
  // arbiter of collisions during approval.
  async register(username: string, password: string): Promise<void> {
    const trimmedUsername = username.trim();
    const passwordHash = await hashPassword(password);

    const user = this.users.create({
      username: trimmedUsername,
      passwordHash,
      role: 'moderator',
      status: 'pending',
    });

    try {
      await this.users.getEntityManager().persistAndFlush(user);
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        return;
      }
      throw error;
    }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.users.findOne({ username: username.trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    if (user.status === 'pending') {
      throw new AccountPendingError();
    }
    if (user.status === 'deactivated') {
      throw new AccountDeactivatedError();
    }

    const token = await this.sessions.create(user);
    return { token, user: toAuthUser(user) };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }

  async approve(userId: number, role: UserRole): Promise<void> {
    const user = await this.users.findOne(userId);
    if (!user) throw new UserNotFoundError(userId);
    user.role = role;
    user.status = 'active';
    await this.users.getEntityManager().flush();
  }

  async deactivate(userId: number): Promise<void> {
    const user = await this.users.findOne(userId);
    if (!user) throw new UserNotFoundError(userId);
    user.status = 'deactivated';
    await this.users.getEntityManager().flush();
    await this.sessions.revokeAllForUser(userId);
  }

  async listUsers(): Promise<UsersListedPayload> {
    const all = await this.users.findAll({ orderBy: { createdAt: 'asc' } });
    const toItem = (user: User): UserListItem => ({
      ...toAuthUser(user),
      createdAt: user.createdAt.toISOString(),
    });

    return {
      pending: all.filter((user) => user.status === 'pending').map(toItem),
      active: all.filter((user) => user.status === 'active').map(toItem),
      deactivated: all
        .filter((user) => user.status === 'deactivated')
        .map(toItem),
    };
  }
}
