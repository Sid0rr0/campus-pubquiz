import { BadRequestException } from '@nestjs/common';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { StatsController } from '@/stats/stats.controller';
import type { StatsService } from '@/stats/stats.service';
import type {
  PlayedSessionsListedPayload,
  SessionDetailStats,
} from '@campus-pubquiz/types';

function makeController() {
  const statsService = {
    listPlayedSessions: jest.fn(),
    getSessionDetail: jest.fn(),
    deleteSession: jest.fn(),
  };
  const controller = new StatsController(
    statsService as unknown as StatsService,
  );
  return { controller, statsService };
}

describe('StatsController', () => {
  it('is protected by SessionGuard + RolesGuard, open to any authenticated role', () => {
    const guards = Reflect.getMetadata('__guards__', StatsController) as
      | unknown[]
      | undefined;
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata('roles', StatsController) as
      | unknown[]
      | undefined;
    expect(roles).toBeUndefined();
  });

  describe('listPlayedSessions', () => {
    it('delegates to statsService.listPlayedSessions with parsed defaults', async () => {
      const { controller, statsService } = makeController();
      const payload: PlayedSessionsListedPayload = {
        items: [
          {
            gameSessionId: 1,
            joinCode: 'ABCDEF',
            quizTitle: 'Quiz Night',
            playedAt: '2026-01-01T00:00:00.000Z',
            teamCount: 2,
            maxPoints: 10,
            winnerTeamName: 'Team A',
            winnerAnswerPoints: 8,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      statsService.listPlayedSessions.mockResolvedValue(payload);

      await expect(controller.listPlayedSessions({})).resolves.toBe(payload);
      expect(statsService.listPlayedSessions).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        sortBy: 'playedAt',
        sortOrder: 'desc',
      });
    });

    it('parses explicit query params', async () => {
      const { controller, statsService } = makeController();
      statsService.listPlayedSessions.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        pageSize: 10,
      });

      await controller.listPlayedSessions({
        page: '2',
        pageSize: '10',
        sortBy: 'quizTitle',
        sortOrder: 'asc',
      });

      expect(statsService.listPlayedSessions).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        sortBy: 'quizTitle',
        sortOrder: 'asc',
      });
    });

    it('rejects an invalid pageSize', async () => {
      const { controller } = makeController();

      await expect(
        controller.listPlayedSessions({ pageSize: '0' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an unknown sortBy column', async () => {
      const { controller } = makeController();

      await expect(
        controller.listPlayedSessions({ sortBy: 'notAColumn' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSessionDetail', () => {
    it('delegates to statsService.getSessionDetail with the parsed id', async () => {
      const { controller, statsService } = makeController();
      const payload = {
        gameSessionId: 1,
        joinCode: 'ABCDEF',
        quizTitle: 'Quiz Night',
        playedAt: '2026-01-01T00:00:00.000Z',
        teamCount: 1,
        maxPoints: 10,
        difficulty: { averagePercent: 80, label: 'Easy' },
        standings: [],
        rounds: [],
        questions: [],
        highlights: {
          hardestQuestionId: null,
          easiestQuestionId: null,
          hardestRoundId: null,
          allCorrectQuestionIds: [],
          noneCorrectQuestionIds: [],
          fastestAnswer: null,
          fastestTeam: null,
          bonus: {
            total: 0,
            byCategory: { shot: 0, selfie: 0, custom: 0 },
            count: 0,
          },
          winningMargin: null,
        },
      } as unknown as SessionDetailStats;
      statsService.getSessionDetail.mockResolvedValue(payload);

      await expect(controller.getSessionDetail(1)).resolves.toBe(payload);
      expect(statsService.getSessionDetail).toHaveBeenCalledWith(1);
    });
  });

  describe('deleteSession', () => {
    it('is restricted to the admin role, unlike the read routes above', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method -- inspected for metadata only, never invoked
      const deleteHandler = StatsController.prototype.deleteSession;
      const roles = Reflect.getMetadata('roles', deleteHandler) as
        | unknown[]
        | undefined;
      expect(roles).toEqual(['admin']);
    });

    it('delegates to statsService.deleteSession with the parsed id', async () => {
      const { controller, statsService } = makeController();
      statsService.deleteSession.mockResolvedValue(undefined);

      await controller.deleteSession(1);

      expect(statsService.deleteSession).toHaveBeenCalledWith(1);
    });
  });
});
