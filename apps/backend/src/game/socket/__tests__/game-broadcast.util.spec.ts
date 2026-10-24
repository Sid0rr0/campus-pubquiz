import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type PresenterContextPayload,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import {
  broadcastAdminState,
  broadcastDisplayState,
  broadcastGameState,
} from '@/game/socket/game-broadcast.util';
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
    currentRoundNote: null,
    currentScreen: { heading: 'Lobby' },
    nextScreen: null,
  };

  function createFakeGameState() {
    return {
      getView: jest.fn((_joinCode: string, room: string) => ({
        ...snapshot,
        viewFor: room,
      })),
      getPresenterContext: jest.fn().mockReturnValue(presenterContext),
    };
  }

  it('emits each room its own STATE_UPDATED view and PRESENTER_CONTEXT_UPDATED to admin alone', () => {
    const server = createMockServer();
    const gameState = createFakeGameState();

    broadcastGameState(
      server as never,
      joinCode,
      gameState as unknown as GameStateService,
    );

    const toCalls = server.to.mock.calls as string[][];
    const stateUpdates = (server.emit.mock.calls as unknown[][])
      .map((call, index) => ({ call, room: toCalls[index][0] }))
      .filter(({ call }) => call[0] === SOCKET_EVENTS.STATE_UPDATED);
    expect(stateUpdates).toHaveLength(3);
    for (const room of Object.values(SOCKET_ROOMS)) {
      expect(stateUpdates).toContainEqual({
        room: sessionRoom(joinCode, room),
        call: [SOCKET_EVENTS.STATE_UPDATED, { ...snapshot, viewFor: room }],
      });
    }
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      presenterContext,
    );
    expect(toCalls[0]).toEqual([sessionRoom(joinCode, SOCKET_ROOMS.ADMIN)]);
  });

  it.each([
    ['broadcastAdminState', broadcastAdminState, SOCKET_ROOMS.ADMIN],
    ['broadcastDisplayState', broadcastDisplayState, SOCKET_ROOMS.DISPLAY],
  ])(
    '%s sends that room alone its own STATE_UPDATED view',
    (_name, broadcast, room) => {
      const server = createMockServer();
      const gameState = createFakeGameState();

      broadcast(
        server as never,
        joinCode,
        gameState as unknown as GameStateService,
      );

      expect(server.to.mock.calls).toEqual([[sessionRoom(joinCode, room)]]);
      expect(server.emit.mock.calls).toEqual([
        [SOCKET_EVENTS.STATE_UPDATED, { ...snapshot, viewFor: room }],
      ]);
    },
  );

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
      expect.objectContaining({ joinCode }),
    );
  });
});
