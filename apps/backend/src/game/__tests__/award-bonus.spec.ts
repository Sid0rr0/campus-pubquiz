import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { InvalidBonusAwardError } from '@/bonus/bonus.service';
import type { GameGateway } from '@/game/game.gateway';
import {
  ADMIN_PASSWORD,
  createMockSocket,
  createTestGateway,
  asSocket,
  useAdminPasswordEnv,
  type MockServer,
  type MockBonusService,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — award bonus', () => {
  useAdminPasswordEnv();

  let gateway: GameGateway;
  let server: MockServer;
  let bonusService: MockBonusService;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, server, bonusService, answerService } =
      await createTestGateway());
  });

  it('awards a predefined-category bonus and refreshes the leaderboard for all rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAwardBonus(asSocket(admin), {
      teamId: 31,
      category: 'shot',
      points: 1,
    });

    expect(bonusService.award).toHaveBeenCalledWith(
      101,
      31,
      'shot',
      1,
      undefined,
    );
    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        leaderboard: [
          {
            teamId: 31,
            teamName: 'The Quizzards',
            totalPoints: 2,
            bonusPoints: 0,
          },
        ],
      }),
    );
  });

  it('awards a custom bonus with an admin-written reason', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAwardBonus(asSocket(admin), {
      teamId: 31,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });

    expect(bonusService.award).toHaveBeenCalledWith(
      101,
      31,
      'custom',
      3,
      'Best team name',
    );
  });

  it('rejects AWARD_BONUS from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleAwardBonus(asSocket(player), {
        teamId: 31,
        category: 'shot',
        points: 1,
      }),
    ).rejects.toThrow(WsException);
    expect(bonusService.award).not.toHaveBeenCalled();
  });

  it('surfaces a validation error from BonusService as a WsException', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));
    bonusService.award.mockRejectedValueOnce(
      new InvalidBonusAwardError('A custom bonus needs a reason'),
    );

    await expect(
      gateway.handleAwardBonus(asSocket(admin), {
        teamId: 31,
        category: 'custom',
        points: 1,
      }),
    ).rejects.toThrow(WsException);
  });
});
