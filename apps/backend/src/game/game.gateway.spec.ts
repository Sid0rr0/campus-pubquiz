import { WsException } from '@nestjs/websockets';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { GameGateway } from './game.gateway';
import { GameStateService } from './game-state.service';

function createMockSocket(role?: string) {
  const rooms = new Set<string>();
  return {
    id: 'socket-1',
    handshake: { query: role === undefined ? {} : { role } },
    join: jest.fn((room: string) => rooms.add(room)),
    rooms,
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as any;
}

function createMockServer() {
  const server = {
    to: jest.fn(() => server),
    emit: jest.fn(),
  };
  return server;
}

describe('GameGateway', () => {
  let gateway: GameGateway;
  let server: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    gateway = new GameGateway(new GameStateService());
    server = createMockServer();
    gateway.server = server;
  });

  it('joins a connecting display client to the display room and sends a state snapshot', () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('disconnects a client that connects without a recognized role', () => {
    const client = createMockSocket('not-a-real-room');
    gateway.handleConnection(client);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    gateway.handleConnection(admin);

    gateway.handleAdminAction(admin, { action: 'START_QUIZ' });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        progress: expect.objectContaining({ status: 'question_open' }),
      }),
    );
  });

  it('rejects an admin action from a non-admin client without broadcasting', () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    gateway.handleConnection(display);

    expect(() =>
      gateway.handleAdminAction(display, { action: 'START_QUIZ' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    gateway.handleConnection(admin);

    // LOCK_ANSWERS is illegal from lobby - quiz hasn't started yet
    expect(() =>
      gateway.handleAdminAction(admin, { action: 'LOCK_ANSWERS' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });
});
