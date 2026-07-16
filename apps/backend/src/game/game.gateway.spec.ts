import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { SeedService } from '../db/seed.service';
import type { SeededGame } from '../db/seed.types';
import { GameGateway } from './game.gateway';
import { GameStateService } from './game-state.service';

const FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 'quiz-1',
  gameSessionId: 'session-1',
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 'round-1',
      breakAfter: false,
      questions: [{ id: 'r1q1', type: 'free_text', prompt: 'Q1', points: 1 }],
    },
  ],
};

function createFakeSeedService(): SeedService {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
  } as unknown as SeedService;
}

function createMockSocket(role?: string) {
  const rooms = new Set<string>();
  return {
    id: 'socket-1',
    handshake: { query: role === undefined ? {} : { role } },
    join: jest.fn((room: string) => rooms.add(room)),
    rooms,
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

type MockSocket = ReturnType<typeof createMockSocket>;

function asSocket(mock: MockSocket): Socket {
  return mock as unknown as Socket;
}

function createMockServer() {
  const to = jest.fn();
  const server = { to, emit: jest.fn() };
  to.mockReturnValue(server);
  return server;
}

type MockServer = ReturnType<typeof createMockServer>;

function asServer(mock: MockServer): Server {
  return mock as unknown as Server;
}

describe('GameGateway', () => {
  let gateway: GameGateway;
  let server: MockServer;

  beforeEach(async () => {
    const gameStateService = new GameStateService(createFakeSeedService());
    await gameStateService.onModuleInit();
    gateway = new GameGateway(gameStateService);
    server = createMockServer();
    gateway.server = asServer(server);
  });

  it('joins a connecting display client to the display room and sends a state snapshot', async () => {
    const client = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(client));

    expect(client.join).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(client.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_SYNC,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'lobby' }),
      }),
    );
  });

  it('disconnects a client that connects without a recognized role', async () => {
    const client = createMockSocket('not-a-real-room');
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client that connects with no role at all', async () => {
    const client = createMockSocket();
    await gateway.handleConnection(asSocket(client));

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('applies an admin action and broadcasts the updated snapshot to all three rooms', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.DISPLAY);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.ADMIN);
    expect(server.to).toHaveBeenCalledWith(SOCKET_ROOMS.PLAYERS);
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.STATE_UPDATED,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'question_open' }),
      }),
    );
  });

  it('rejects an admin action from a non-admin client without broadcasting', async () => {
    const display = createMockSocket(SOCKET_ROOMS.DISPLAY);
    await gateway.handleConnection(asSocket(display));

    expect(() =>
      gateway.handleAdminAction(asSocket(display), { action: 'START_QUIZ' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });

  it('propagates an illegal-transition error for an out-of-order admin action without broadcasting', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN);
    await gateway.handleConnection(asSocket(admin));

    // LOCK_ANSWERS is illegal from lobby - quiz hasn't started yet
    expect(() =>
      gateway.handleAdminAction(asSocket(admin), { action: 'LOCK_ANSWERS' }),
    ).toThrow(WsException);
    expect(server.emit).not.toHaveBeenCalled();
  });
});
