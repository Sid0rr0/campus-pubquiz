import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type PresenterContextPayload,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';

function createMockServer() {
  const to = jest.fn();
  const server = { to, emit: jest.fn() };
  to.mockReturnValue(server);
  return server;
}

describe('broadcastGameState', () => {
  const joinCode = 'ABCDEF';
  const snapshot = {
    joinCode,
    progress: { status: 'lobby' },
  } as unknown as StateSnapshotPayload;
  const presenterContext: PresenterContextPayload = {
    currentQuestionNotes: 'note',
    nextQuestion: null,
  };

  function createFakeGameState() {
    return {
      getSnapshot: jest.fn().mockReturnValue(snapshot),
      getPresenterContext: jest.fn().mockReturnValue(presenterContext),
    };
  }

  it('emits STATE_UPDATED to display/admin/players and PRESENTER_CONTEXT_UPDATED to admin alone', () => {
    const server = createMockServer();
    const gameState = createFakeGameState();

    broadcastGameState(
      server as never,
      joinCode,
      gameState as unknown as GameStateService,
    );

    expect(server.to).toHaveBeenCalledWith(
      sessionRoom(joinCode, SOCKET_ROOMS.DISPLAY),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom(joinCode, SOCKET_ROOMS.ADMIN),
    );
    expect(server.to).toHaveBeenCalledWith(
      sessionRoom(joinCode, SOCKET_ROOMS.PLAYERS),
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      snapshot,
    );
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      presenterContext,
    );
  });

  it('emits STATE_UPDATED last, so it always reflects the most recent snapshot read', () => {
    const server = createMockServer();
    const gameState = createFakeGameState();

    broadcastGameState(
      server as never,
      joinCode,
      gameState as unknown as GameStateService,
    );

    expect(server.emit).toHaveBeenLastCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      snapshot,
    );
  });
});
