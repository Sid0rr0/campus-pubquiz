import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AccountDeactivatedError,
  AccountPendingError,
  type AuthService,
  InvalidCredentialsError,
} from '@/auth/auth.service';
import { AuthController } from '@/auth/auth.controller';
import { SESSION_COOKIE_NAME } from '@/auth/session-cookie';
import type { AuthUser } from '@campus-pubquiz/types';

function makeController() {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };
  const controller = new AuthController(authService as unknown as AuthService);
  return { controller, authService };
}

function makeResponse() {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const res = { cookie, clearCookie } as unknown as Response;
  return { res, cookie, clearCookie };
}

describe('AuthController', () => {
  describe('register', () => {
    it('rejects a body missing username or password', async () => {
      const { controller } = makeController();

      await expect(controller.register({ username: 'alice' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.register({ password: 'pw' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns pending status on success', async () => {
      const { controller, authService } = makeController();
      authService.register.mockResolvedValue(undefined);

      await expect(
        controller.register({ username: 'alice', password: 'hunter22' }),
      ).resolves.toEqual({
        status: 'pending',
      });
      expect(authService.register).toHaveBeenCalledWith('alice', 'hunter22');
    });

    it('rejects a password shorter than the minimum length', async () => {
      const { controller, authService } = makeController();

      await expect(
        controller.register({ username: 'alice', password: 'short' }),
      ).rejects.toThrow(BadRequestException);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('does not surface a taken-username conflict (avoids username enumeration)', async () => {
      const { controller, authService } = makeController();
      authService.register.mockResolvedValue(undefined);

      await expect(
        controller.register({ username: 'alice', password: 'hunter22' }),
      ).resolves.toEqual({ status: 'pending' });
    });
  });

  describe('login', () => {
    it('rejects a body missing credentials', async () => {
      const { controller } = makeController();

      await expect(controller.login({}, makeResponse().res)).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      new InvalidCredentialsError(),
      new AccountPendingError(),
      new AccountDeactivatedError(),
    ])('maps %p to 401 unauthorized', async (error) => {
      const { controller, authService } = makeController();
      authService.login.mockRejectedValue(error);

      await expect(
        controller.login(
          { username: 'alice', password: 'wrong' },
          makeResponse().res,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('sets the session cookie and returns the user on success', async () => {
      const { controller, authService } = makeController();
      const authUser: AuthUser = {
        id: 1,
        username: 'alice',
        role: 'admin',
        status: 'active',
      };
      authService.login.mockResolvedValue({ token: 'tok', user: authUser });
      const { res, cookie } = makeResponse();

      await expect(
        controller.login({ username: 'alice', password: 'hunter22' }, res),
      ).resolves.toEqual({
        user: authUser,
      });
      expect(cookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        'tok',
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('revokes the token from the session cookie and clears it', async () => {
      const { controller, authService } = makeController();
      const req = {
        cookies: { [SESSION_COOKIE_NAME]: 'some-token' },
      } as unknown as Request;
      const { res, clearCookie } = makeResponse();

      await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('some-token');
      expect(clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.any(Object),
      );
    });
  });

  describe('me', () => {
    it('returns the request user set by SessionGuard', () => {
      const { controller } = makeController();
      const authUser: AuthUser = {
        id: 1,
        username: 'alice',
        role: 'admin',
        status: 'active',
      };
      const req = { user: authUser } as Request & { user: AuthUser };

      expect(controller.me(req)).toEqual({ user: authUser });
    });
  });
});
