import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  ADMIN_PASSWORD,
  createMockSocket,
  createTestGateway,
  asSocket,
  useAdminPasswordEnv,
  type MockServer,
  type MockAnswerService,
} from './test-utils';

describe('GameGateway — admin actions', () => {
  useAdminPasswordEnv();

  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;

  beforeEach(async () => {
    ({ gateway, server, answerService } = await createTestGateway());
  });

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'rules' }),
      }),
    );
  });

  it('recomputes the leaderboard when toggled on, so every joined team shows up even before any grading', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });

    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
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

  it('does not recompute the leaderboard when toggled off', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    }); // on
    answerService.computeLeaderboard.mockClear();

    await gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    }); // off

    expect(answerService.computeLeaderboard).not.toHaveBeenCalled();
  });

  it('rejects an admin action from a non-admin client without broadcasting', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));

    await expect(
      gateway.handleAdminAction(asSocket(display), { action: 'START_QUIZ' }),
    ).rejects.toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    // ADVANCE is illegal from lobby - quiz hasn't started yet
    await expect(
      gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }),
    ).rejects.toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });
});
