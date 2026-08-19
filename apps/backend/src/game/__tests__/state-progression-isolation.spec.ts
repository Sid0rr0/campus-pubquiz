import { SOCKET_ROOMS, sessionRoom } from '@campus-pubquiz/types';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  asSocket,
} from '@/game/__tests__/test-utils';
import { setupConcurrentSessionsTest } from '@/game/__tests__/concurrent-sessions-test-utils';

describe('GameGateway — concurrent sessions: state machine progression isolation', () => {
  const { state, openSessionA } = setupConcurrentSessionsTest();

  it('advances two sessions through the state machine independently, with no shared progress', async () => {
    await openSessionA();
    expect(state.gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );

    await state.gameStateService.createSession(20);
    const adminB = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-1',
      'BBBBBB',
    );
    await state.gateway.handleConnection(asSocket(adminB));

    // Creating B must not touch A's already-open question.
    expect(state.gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );
    expect(state.gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
      'lobby',
    );

    state.server.to.mockClear();
    state.server.emit.mockClear();
    await state.gateway.handleAdminAction(asSocket(adminB), {
      action: 'START_QUIZ',
    });
    await state.gateway.handleAdminAction(asSocket(adminB), {
      action: 'ADVANCE',
    });
    await state.gateway.handleAdminAction(asSocket(adminB), {
      action: 'ADVANCE',
    });

    expect(state.gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
      'question_open',
    );
    expect(state.gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
      'question_open',
    );
    expect(
      state.gameStateService.getSnapshot('AAAAAA').currentQuestion?.id,
    ).toBe(501);
    expect(
      state.gameStateService.getSnapshot('BBBBBB').currentQuestion?.id,
    ).toBe(502);
    expect(state.gameStateService.getGameSessionId('AAAAAA')).toBe(301);
    expect(state.gameStateService.getGameSessionId('BBBBBB')).toBe(302);

    // The last ADVANCE (B's) must only have broadcast to B's rooms.
    expect(state.server.to).toHaveBeenCalledWith(
      sessionRoom('BBBBBB', SOCKET_ROOMS.DISPLAY),
    );
    expect(state.server.to).not.toHaveBeenCalledWith(
      sessionRoom('AAAAAA', SOCKET_ROOMS.DISPLAY),
    );
  });
});
