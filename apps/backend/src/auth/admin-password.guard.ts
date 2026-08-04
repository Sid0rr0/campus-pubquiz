import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Mirrors the admin password check GameGateway does on the socket handshake
 * (see isValidAdminPassword in game.gateway.ts), but for REST: the header
 * must match a non-empty ADMIN_PASSWORD env var exactly.
 */
@Injectable()
export class AdminPasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const password = request.headers['x-admin-password'];
    const expected = process.env.ADMIN_PASSWORD;

    if (
      typeof password !== 'string' ||
      password.length === 0 ||
      !expected ||
      password !== expected
    ) {
      throw new UnauthorizedException('Invalid admin password');
    }

    return true;
  }
}
