import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
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
  UsernameTakenError,
} from '@/auth/auth.service';
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/auth/session-cookie';
import { SessionGuard } from '@/auth/session.guard';

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
  async register(
    @Body() body: Partial<RegisterRequest>,
  ): Promise<RegisterResponse> {
    const { username, password } = requireCredentials(body);
    try {
      await this.authService.register(username, password);
      return { status: 'pending' };
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Post('login')
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
