import {
  BadRequestException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import type { TeamHistoryService } from '@/team/team-history.service';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { TeamsController } from '@/team/teams.controller';
import type { TeamService } from '@/team/team.service';
import type { TeamCodeView, TeamsListedPayload } from '@campus-pubquiz/types';

function makeController() {
  const teamService = {
    listAll: jest.fn(),
    getTeamCode: jest.fn(),
  };
  const teamHistory = { detail: jest.fn() };
  const controller = new TeamsController(
    teamService as unknown as TeamService,
    teamHistory as unknown as TeamHistoryService,
  );
  return { controller, teamService, teamHistory };
}

describe('TeamsController', () => {
  it('is protected by SessionGuard + RolesGuard, open to any authenticated role', () => {
    const guards = Reflect.getMetadata('__guards__', TeamsController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata('roles', TeamsController) as
      | unknown[]
      | undefined;
    expect(roles).toBeUndefined();
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

    it('accepts averagePlacing as a sort column', async () => {
      const { controller, teamService } = makeController();
      teamService.listAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.list({ sortBy: 'averagePlacing', sortOrder: 'asc' });

      expect(teamService.listAll).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'averagePlacing', sortOrder: 'asc' }),
      );
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

  describe('getDetail', () => {
    it('returns the team history from the history service', async () => {
      const { controller, teamHistory } = makeController();
      const detail = { id: 7, name: 'The Quizzards' };
      teamHistory.detail.mockResolvedValue(detail);

      await expect(controller.getDetail(7)).resolves.toBe(detail);
      expect(teamHistory.detail).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundException for an unknown team', async () => {
      const { controller, teamHistory } = makeController();
      teamHistory.detail.mockResolvedValue(null);

      await expect(controller.getDetail(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a non-numeric id', async () => {
      const pipe = new ParseIntPipe();

      await expect(
        pipe.transform('abc', { type: 'param', data: 'id' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCode', () => {
    it('delegates to teamService.getTeamCode and returns its result', async () => {
      const { controller, teamService } = makeController();
      const view: TeamCodeView = {
        teamId: 7,
        teamName: 'The Quizzards',
        code: 'ABC123',
      };
      teamService.getTeamCode.mockResolvedValue(view);

      await expect(controller.getCode(7)).resolves.toBe(view);
      expect(teamService.getTeamCode).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundException when the team does not exist', async () => {
      const { controller, teamService } = makeController();
      teamService.getTeamCode.mockResolvedValue(null);

      await expect(controller.getCode(999)).rejects.toThrow(NotFoundException);
    });
  });
});
