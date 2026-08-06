import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@campus-pubquiz/types';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import { SessionService } from '@/auth/session.service';

// Cookie-based auth is CSRF-exposed since the browser attaches the session
// cookie to any cross-site request, including a plain HTML form submission —
// CORS's origin allowlist only blocks script-driven fetch/XHR, not that.
// Requiring this header blocks forms outright (they can't set custom
// headers) and forces script-driven requests through a CORS preflight,
// bringing the origin allowlist back into play. Only enforced on state-
// changing methods; GET/HEAD/OPTIONS are left alone since they don't need
// it and enforcing it there would just break plain navigation/links.
const CSRF_HEADER_NAME = 'x-requested-with';
const CSRF_HEADER_VALUE = 'XMLHttpRequest';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    if (
      !SAFE_METHODS.has(request.method) &&
      request.headers[CSRF_HEADER_NAME] !== CSRF_HEADER_VALUE
    ) {
      throw new ForbiddenException(
        `Missing required ${CSRF_HEADER_NAME} header`,
      );
    }

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
