import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import { User } from '@/db/entities/user.entity';
import { UserRepository } from '@/db/repositories/user.repository';
import { hashPassword } from '@/auth/password-hash';

// Self-registration requires an admin to approve new accounts, which is a
// bootstrap problem: the very first admin can't be approved by anyone. This
// runs once at startup and creates (or promotes) one from optional env vars
// — a no-op forever once a real admin exists, so it's safe to leave set.
@Injectable()
export class AuthBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AuthBootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly users: UserRepository,
    private readonly orm: MikroORM,
  ) {}

  // onModuleInit runs at bootstrap, before any HTTP/socket request has
  // entered the app, so there is no per-request MikroORM context yet for
  // the injected repository to use — @CreateRequestContext() forks one.
  @CreateRequestContext()
  async onModuleInit(): Promise<void> {
    const existingAdmin = await this.users.findOne({ role: 'admin' });
    if (existingAdmin) return;

    const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!username || !password) {
      this.logger.warn(
        'No admin account exists and BOOTSTRAP_ADMIN_USERNAME/BOOTSTRAP_ADMIN_PASSWORD are unset — set them to bootstrap one, or promote a user manually.',
      );
      return;
    }

    const passwordHash = await hashPassword(password);
    const existingUser = await this.users.findOne({ username });

    if (existingUser) {
      existingUser.role = 'admin';
      existingUser.status = 'active';
      await this.users.getEntityManager().flush();
      this.logger.log(`Promoted existing user "${username}" to admin.`);
      return;
    }

    this.users.create({
      username,
      passwordHash,
      role: 'admin',
      status: 'active',
    });
    await this.users.getEntityManager().flush();
    this.logger.log(`Bootstrap admin "${username}" created.`);
  }
}
