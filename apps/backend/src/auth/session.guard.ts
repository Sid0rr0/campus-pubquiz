import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@campus-pubquiz/types';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import { SessionService } from '@/auth/session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token !== 'string') {
      throw new UnauthorizedException('Missing or invalid session cookie');
    }

    const validated = await this.sessions.validate(token);
    if (!validated) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = validated.user;
    return true;
  }
}
