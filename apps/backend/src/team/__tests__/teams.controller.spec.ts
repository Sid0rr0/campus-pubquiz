import { BadRequestException } from '@nestjs/common';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { TeamsController } from '@/team/teams.controller';
import type { TeamService } from '@/team/team.service';
import type { TeamsListedPayload } from '@campus-pubquiz/types';

function makeController() {
  const teamService = {
    listAll: jest.fn(),
  };
  const controller = new TeamsController(teamService as unknown as TeamService);
  return { controller, teamService };
}

describe('TeamsController', () => {
  it('is protected by SessionGuard + RolesGuard, admin-only', () => {
    const guards = Reflect.getMetadata('__guards__', TeamsController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata('roles', TeamsController) as
      | unknown[]
      | undefined;
    expect(roles).toEqual(['admin']);
  });

  describe('list', () => {
    it('delegates to teamService.listAll with parsed defaults', async () => {
      const { controller, teamService } = makeController();
      const payload: TeamsListedPayload = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      teamService.listAll.mockResolvedValue(payload);

      await expect(controller.list({})).resolves.toBe(payload);
      expect(teamService.listAll).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        sortBy: 'joinedAt',
        sortOrder: 'desc',
      });
    });

    it('parses explicit query params', async () => {
      const { controller, teamService } = makeController();
      teamService.listAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await controller.list({
        page: '2',
        pageSize: '10',
        sortBy: 'sessionsJoined',
        sortOrder: 'asc',
      });

      expect(teamService.listAll).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        sortBy: 'sessionsJoined',
        sortOrder: 'asc',
      });
    });

    it('rejects an invalid pageSize', async () => {
      const { controller } = makeController();

      await expect(controller.list({ pageSize: '0' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown sortBy column', async () => {
      const { controller } = makeController();

      await expect(controller.list({ sortBy: 'notAColumn' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
