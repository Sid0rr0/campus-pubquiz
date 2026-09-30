import {
  DISPLAY_TEXT_SCALE_STEPS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import {
  asSocket,
  createMockSocket,
  type MockSocket,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const NO_SESSION_ERROR = 'Connection not associated with a game session';
const CLIENT_EVENT_COUNT = 11;

interface Ids {
  teamId: number;
  questionId: number;
}

interface EventCase {
  name: string;
  allowedRoom: SocketRoomName;
  rejection: string;
  send: (
    gateway: GameGateway,
    socket: MockSocket,
    payload: unknown,
  ) => Promise<AckResult>;
  payload: (ids: Ids) => unknown;
}

// Deliberately its own list, not derived from the gateway: the spec pins
// today's authorization so a refactor of how events are declared can't move it.
const EVENT_CASES: EventCase[] = [
  {
    name: SOCKET_EVENTS.ADMIN_ACTION,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may perform game actions',
    send: (gateway, socket, payload) =>
      gateway.handleAdminAction(asSocket(socket), payload),
    payload: () => ({ action: 'ADVANCE' }),
  },
  {
    name: SOCKET_EVENTS.JOIN_PLAYERS,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may join a team',
    send: (gateway, socket, payload) =>
      gateway.handleJoinPlayers(asSocket(socket), payload),
    payload: () => ({ teamName: 'Intruders' }),
  },
  {
    name: SOCKET_EVENTS.SUBMIT_ANSWER,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may submit answers',
    send: (gateway, socket, payload) =>
      gateway.handleSubmitAnswer(asSocket(socket), payload),
    payload: ({ teamId, questionId }) => ({
      questionId,
      teamId,
      value: 'Paris',
    }),
  },
  {
    name: SOCKET_EVENTS.GRADE_ANSWER,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may grade answers',
    send: (gateway, socket, payload) =>
      gateway.handleGradeAnswer(asSocket(socket), payload),
    payload: () => ({ answerId: 1, pointsAwarded: 1 }),
  },
  {
    name: SOCKET_EVENTS.KICK_TEAM,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may remove a team',
    send: (gateway, socket, payload) =>
      gateway.handleKickTeam(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId }),
  },
  {
    name: SOCKET_EVENTS.LEAVE_SESSION,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may leave a session',
    send: (gateway, socket, payload) =>
      gateway.handleLeaveSession(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId }),
  },
  {
    name: SOCKET_EVENTS.SET_BREAK_END_TIME,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the break end time',
    send: (gateway, socket, payload) =>
      gateway.handleSetBreakEndTime(asSocket(socket), payload),
    payload: () => ({ breakEndsAt: null }),
  },
  {
    name: SOCKET_EVENTS.SET_DISPLAY_TEXT_SCALE,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may set the display text scale',
    send: (gateway, socket, payload) =>
      gateway.handleSetDisplayTextScale(asSocket(socket), payload),
    payload: () => ({ displayTextScale: DISPLAY_TEXT_SCALE_STEPS[0] }),
  },
  {
    name: SOCKET_EVENTS.AWARD_BONUS,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may award bonus points',
    send: (gateway, socket, payload) =>
      gateway.handleAwardBonus(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId, category: 'custom', points: 1 }),
  },
  {
    name: SOCKET_EVENTS.CREATE_SHOWDOWN_ROUND,
    allowedRoom: SOCKET_ROOMS.ADMIN,
    rejection: 'Only admin clients may start a showdown round',
    send: (gateway, socket, payload) =>
      gateway.handleCreateShowdownRound(asSocket(socket), payload),
    payload: () => ({ question: 'How many?', answer: '42', points: 1 }),
  },
  {
    name: SOCKET_EVENTS.SUBMIT_SHOWDOWN_GUESS,
    allowedRoom: SOCKET_ROOMS.PLAYERS,
    rejection: 'Only player clients may submit a showdown guess',
    send: (gateway, socket, payload) =>
      gateway.handleSubmitShowdownGuess(asSocket(socket), payload),
    payload: ({ teamId }) => ({ showdownRoundId: 1, teamId, value: '42' }),
  },
];

const ALL_ROOMS: SocketRoomName[] = [
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
  SOCKET_ROOMS.DISPLAY,
];

const eventRows = EVENT_CASES.map((event) => [event.name, event] as const);

const wrongRoomRows = EVENT_CASES.flatMap((event) =>
  ALL_ROOMS.filter((room) => room !== event.allowedRoom).map(
    (room) => [event.name, room, event] as const,
  ),
);

describe('GameGateway — socket event authorization', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let sockets: Record<SocketRoomName, MockSocket>;
  let ids: Ids;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-auth',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));
    game.server.sockets.sockets.set(display.id, display);
    sockets = {
      [SOCKET_ROOMS.ADMIN]: admin,
      [SOCKET_ROOMS.PLAYERS]: game.teams[0].socket,
      [SOCKET_ROOMS.DISPLAY]: display,
    };
    ids = {
      teamId: game.teams[0].teamId,
      questionId: game.questionIds.multipleChoice,
    };
    await game.openFirstQuestion(admin);
    game.clearEmits();
    Object.values(sockets).forEach((socket) => socket.emit.mockClear());
  });

  /** A rejected event must leave no trace: no room broadcast, nothing to any socket. */
  function expectNothingDelivered(...extra: MockSocket[]): void {
    expect(game.roomEmits()).toEqual([]);
    [...Object.values(sockets), ...extra].forEach((socket) =>
      expect(socket.emit).not.toHaveBeenCalled(),
    );
  }

  it('lists every client-to-server socket event once', () => {
    expect(new Set(EVENT_CASES.map((event) => event.name)).size).toBe(
      CLIENT_EVENT_COUNT,
    );
  });

  it.each(wrongRoomRows)(
    'rejects %s sent from the %s room',
    async (_name, room, event) => {
      const result = await event.send(
        game.gateway,
        sockets[room],
        event.payload(ids),
      );

      expect(result).toEqual({ success: false, error: event.rejection });
      expectNothingDelivered();
    },
  );

  it.each(eventRows)(
    'rejects %s from a socket with no game session',
    async (_name, event) => {
      const orphan = createMockSocket(undefined, {}, 'orphan', null);

      const result = await event.send(game.gateway, orphan, event.payload(ids));

      expect(result).toEqual({ success: false, error: NO_SESSION_ERROR });
      expectNothingDelivered(orphan);
    },
  );

  it.each(eventRows)(
    'reports the payload error, not the room error, for an invalid %s from the wrong room',
    async (_name, event) => {
      const wrongRoom = ALL_ROOMS.find((room) => room !== event.allowedRoom)!;

      const result = await event.send(game.gateway, sockets[wrongRoom], {});

      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/^Invalid /) as string,
      });
      expectNothingDelivered();
    },
  );
});
