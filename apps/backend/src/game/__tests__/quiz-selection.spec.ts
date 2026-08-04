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
  type MockSeedService,
} from './test-utils';

describe('GameGateway — quiz selection', () => {
  useAdminPasswordEnv();

  let gateway: GameGateway;
  let server: MockServer;
  let seedService: MockSeedService;

  beforeEach(async () => {
    ({ gateway, server, seedService } = await createTestGateway());
  });

  it('selects a quiz and broadcasts the reset snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));

    await gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 });

    expect(seedService.createSession).toHaveBeenCalledWith(2);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('rejects SELECT_QUIZ from a non-admin client', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS);
    await gateway.handleConnection(asSocket(player));

    await expect(
      gateway.handleSelectQuiz(asSocket(player), { quizId: 2 }),
    ).rejects.toThrow(WsException);
    expect(seedService.createSession).not.toHaveBeenCalled();
  });

  it('surfaces a mid-game quiz selection as a WsException', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      password: ADMIN_PASSWORD,
    });
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    await expect(
      gateway.handleSelectQuiz(asSocket(admin), { quizId: 2 }),
    ).rejects.toThrow(WsException);
    expect(seedService.createSession).not.toHaveBeenCalled();
  });
});
