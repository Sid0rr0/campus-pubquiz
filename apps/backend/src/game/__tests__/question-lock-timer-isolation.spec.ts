import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { setupConcurrentSessionsTest } from '@/game/__tests__/concurrent-sessions-test-utils';

describe('GameGateway — concurrent sessions: question-lock timer isolation', () => {
  const { state, openSessionA, createAndOpenSessionB } =
    setupConcurrentSessionsTest();

  it('arms independent question-lock timers per session; cancelling one never disturbs the other', async () => {
    jest.useFakeTimers();
    try {
      const adminA = await openSessionA();
      const adminB = await createAndOpenSessionB();

      await state.gateway.handleAdminAction(asSocket(adminA), {
        action: 'ADVANCE',
      }); // A -> locking
      await state.gateway.handleAdminAction(asSocket(adminB), {
        action: 'ADVANCE',
      }); // B -> locking

      expect(state.gameStateService.getQuestionLockAt('AAAAAA')).not.toBeNull();
      expect(state.gameStateService.getQuestionLockAt('BBBBBB')).not.toBeNull();

      await state.gateway.handleAdminAction(asSocket(adminB), {
        action: 'PREVIOUS',
      }); // cancels B's timer only
      expect(state.gameStateService.getQuestionLockAt('BBBBBB')).toBeNull();
      expect(state.gameStateService.getQuestionLockAt('AAAAAA')).not.toBeNull();

      state.server.to.mockClear();
      state.server.emit.mockClear();
      await jest.advanceTimersByTimeAsync(60_000);

      expect(state.gameStateService.getSnapshot('AAAAAA').progress.status).toBe(
        'break_intro',
      );
      expect(state.gameStateService.getSnapshot('BBBBBB').progress.status).toBe(
        'question_open',
      );
      expect(state.server.to).toHaveBeenCalledWith(
        sessionRoom('AAAAAA', SOCKET_ROOMS.DISPLAY),
      );
      expect(state.server.to).not.toHaveBeenCalledWith(
        sessionRoom('BBBBBB', SOCKET_ROOMS.DISPLAY),
      );
      expect(state.server.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.STATE_UPDATED,
        expect.objectContaining({
          joinCode: 'AAAAAA',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
