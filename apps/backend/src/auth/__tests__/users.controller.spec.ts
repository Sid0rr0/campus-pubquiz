import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { UsersController } from '@/auth/users.controller';
import { UserNotFoundError, type AuthService } from '@/auth/auth.service';
import type { UsersListedPayload } from '@campus-pubquiz/types';

function makeController() {
  const authService = {
    listUsers: jest.fn(),
    approve: jest.fn(),
    deactivate: jest.fn(),
  };
  const controller = new UsersController(authService as unknown as AuthService);
  return { controller, authService };
}

describe('UsersController', () => {
  it('is protected by SessionGuard + RolesGuard, admin-only', () => {
    const guards = Reflect.getMetadata('__guards__', UsersController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata('roles', UsersController) as
      | unknown[]
      | undefined;
    expect(roles).toEqual(['admin']);
  });

  describe('list', () => {
    it('returns the bucketed user list from the service', async () => {
      const { controller, authService } = makeController();
      const payload: UsersListedPayload = {
        pending: [],
        active: [],
        deactivated: [],
      };
      authService.listUsers.mockResolvedValue(payload);

      await expect(controller.list()).resolves.toBe(payload);
    });
  });

  describe('approve', () => {
    it('rejects an invalid role', async () => {
      const { controller } = makeController();

      await expect(
        controller.approve(5, { role: 'superadmin' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves with a valid role', async () => {
      const { controller, authService } = makeController();

      await controller.approve(5, { role: 'moderator' });

      expect(authService.approve).toHaveBeenCalledWith(5, 'moderator');
    });

    it('maps UserNotFoundError to a 404', async () => {
      const { controller, authService } = makeController();
      authService.approve.mockRejectedValue(new UserNotFoundError(999));

      await expect(
        controller.approve(999, { role: 'moderator' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deactivates the given user id', async () => {
      const { controller, authService } = makeController();

      await controller.deactivate(5);

      expect(authService.deactivate).toHaveBeenCalledWith(5);
    });

    it('maps UserNotFoundError to a 404', async () => {
      const { controller, authService } = makeController();
      authService.deactivate.mockRejectedValue(new UserNotFoundError(999));

      await expect(controller.deactivate(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
