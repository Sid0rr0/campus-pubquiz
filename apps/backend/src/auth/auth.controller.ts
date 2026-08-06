import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from '@campus-pubquiz/types';
import {
  AccountDeactivatedError,
  AccountPendingError,
  AuthService,
  InvalidCredentialsError,
} from '@/auth/auth.service';
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/auth/session-cookie';
import { SessionGuard } from '@/auth/session.guard';

const MIN_PASSWORD_LENGTH = 8;

function requireCredentials(body: Partial<LoginRequest>): LoginRequest {
  if (typeof body.username !== 'string' || body.username.trim() === '') {
    throw new BadRequestException('username is required');
  }
  if (typeof body.password !== 'string' || body.password === '') {
    throw new BadRequestException('password is required');
  }
  return { username: body.username, password: body.password };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  async register(
    @Body() body: Partial<RegisterRequest>,
  ): Promise<RegisterResponse> {
    const { username, password } = requireCredentials(body);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    await this.authService.register(username, password);
    return { status: 'pending' };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() body: Partial<LoginRequest>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { username, password } = requireCredentials(body);
    try {
      const { token, user } = await this.authService.login(username, password);
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      return { user };
    } catch (error) {
      if (
        error instanceof InvalidCredentialsError ||
        error instanceof AccountPendingError ||
        error instanceof AccountDeactivatedError
      ) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token === 'string') {
      await this.authService.logout(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: Request & { user: AuthUser }): MeResponse {
    return { user: req.user };
  }
}
