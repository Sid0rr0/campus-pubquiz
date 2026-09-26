import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { StatsController } from '@/stats/stats.controller';
import type { StatsService } from '@/stats/stats.service';
import type { PlayedSessionStats } from '@campus-pubquiz/types';

function makeController() {
  const statsService = {
    listPlayedSessions: jest.fn(),
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
    it('delegates to statsService.listPlayedSessions and returns its result', async () => {
      const { controller, statsService } = makeController();
      const payload: PlayedSessionStats[] = [
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
      ];
      statsService.listPlayedSessions.mockResolvedValue(payload);

      await expect(controller.listPlayedSessions()).resolves.toBe(payload);
      expect(statsService.listPlayedSessions).toHaveBeenCalledWith();
    });
  });
});
