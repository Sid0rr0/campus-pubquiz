import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  TeamMergeNotFoundError,
  TeamMergeRefusedError,
  type TeamMergeService,
} from '@/team/team-merge.service';
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
  const teamMerge = {
    candidates: jest.fn(),
    pairPreview: jest.fn(),
    merge: jest.fn(),
  };
  const controller = new TeamsController(
    teamService as unknown as TeamService,
    teamHistory as unknown as TeamHistoryService,
    teamMerge as unknown as TeamMergeService,
  );
  return { controller, teamService, teamHistory, teamMerge };
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

  describe('merge', () => {
    it('delegates to the merge module and returns the kept team', async () => {
      const { controller, teamMerge } = makeController();
      teamMerge.merge.mockResolvedValue({ keptTeamId: 8 });

      await expect(
        controller.merge(7, { otherTeamId: 8, name: 'Quizzly Bears' }),
      ).resolves.toEqual({ keptTeamId: 8 });
      expect(teamMerge.merge).toHaveBeenCalledWith(7, 8, 'Quizzly Bears');
    });

    it.each([
      {},
      { otherTeamId: 'x', name: 'A' },
      { otherTeamId: 8, name: '' },
      { otherTeamId: 8 },
    ])('rejects the invalid body %j with 400', async (body) => {
      const { controller, teamMerge } = makeController();

      await expect(controller.merge(7, body)).rejects.toThrow(
        BadRequestException,
      );
      expect(teamMerge.merge).not.toHaveBeenCalled();
    });

    it('turns a refusal into 409 with the reason', async () => {
      const { controller, teamMerge } = makeController();
      teamMerge.merge.mockRejectedValue(
        new TeamMergeRefusedError('Both teams took part in Night 1'),
      );

      const attempt = controller.merge(7, { otherTeamId: 8, name: 'A' });
      await expect(attempt).rejects.toThrow(ConflictException);
      await expect(attempt).rejects.toThrow('Both teams took part in Night 1');
    });

    it('turns an unknown team into 404', async () => {
      const { controller, teamMerge } = makeController();
      teamMerge.merge.mockRejectedValue(new TeamMergeNotFoundError(8));

      await expect(
        controller.merge(7, { otherTeamId: 8, name: 'A' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mergePreview', () => {
    it('lists the candidates without an other-team id', async () => {
      const { controller, teamMerge } = makeController();
      teamMerge.candidates.mockResolvedValue([]);

      await expect(controller.mergePreview(7, {})).resolves.toEqual({
        candidates: [],
      });
      expect(teamMerge.candidates).toHaveBeenCalledWith(7);
    });

    it('previews the pair with an other-team id', async () => {
      const { controller, teamMerge } = makeController();
      const preview = { newerTeamId: 8 };
      teamMerge.pairPreview.mockResolvedValue(preview);

      await expect(
        controller.mergePreview(7, { otherTeamId: '8' }),
      ).resolves.toBe(preview);
      expect(teamMerge.pairPreview).toHaveBeenCalledWith(7, 8);
    });

    it('rejects a bad other-team id with 400', async () => {
      const { controller } = makeController();

      await expect(
        controller.mergePreview(7, { otherTeamId: 'abc' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps a refused pair to 409 and an unknown team to 404', async () => {
      const { controller, teamMerge } = makeController();
      teamMerge.pairPreview.mockRejectedValueOnce(
        new TeamMergeRefusedError('no'),
      );
      teamMerge.candidates.mockRejectedValueOnce(new TeamMergeNotFoundError(7));

      await expect(
        controller.mergePreview(7, { otherTeamId: '8' }),
      ).rejects.toThrow(ConflictException);
      await expect(controller.mergePreview(7, {})).rejects.toThrow(
        NotFoundException,
      );
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
