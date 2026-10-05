import {
  DISPLAY_TEXT_SCALE_STEPS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
  type SocketRoomName,
} from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import { SOCKET_EVENT_DECLARATIONS } from '@/game/socket/socket-event-declarations';
import {
  asSocket,
  createMockSocket,
  type MockSocket,
} from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const NO_SESSION_ERROR = 'Connection not associated with a game session';

interface Ids {
  teamId: number;
  questionId: number;
}

/** How to send one declared event: the gateway method that handles it and a well-formed payload. */
interface EventSender {
  send: (
    gateway: GameGateway,
    socket: MockSocket,
    payload: unknown,
  ) => Promise<AckResult>;
  payload: (ids: Ids) => unknown;
}

const D = SOCKET_EVENT_DECLARATIONS;

// Keyed by declaration, so the rooms and rejection messages come from the
// table itself and a new declaration without a sender fails the coverage case.
const SENDERS: Record<keyof typeof D, EventSender> = {
  adminAction: {
    send: (gateway, socket, payload) =>
      gateway.handleAdminAction(asSocket(socket), payload),
    payload: () => ({ action: 'ADVANCE' }),
  },
  joinPlayers: {
    send: (gateway, socket, payload) =>
      gateway.handleJoinPlayers(asSocket(socket), payload),
    payload: () => ({ teamName: 'Intruders' }),
  },
  submitAnswer: {
    send: (gateway, socket, payload) =>
      gateway.handleSubmitAnswer(asSocket(socket), payload),
    payload: ({ teamId, questionId }) => ({
      questionId,
      teamId,
      value: 'Paris',
    }),
  },
  rateRound: {
    send: (gateway, socket, payload) =>
      gateway.handleRateRound(asSocket(socket), payload),
    payload: () => ({ roundId: 1, stars: 3 }),
  },
  sendFeedback: {
    send: (gateway, socket, payload) =>
      gateway.handleSendFeedback(asSocket(socket), payload),
    payload: () => ({ comment: 'Great night', topics: ['Geography'] }),
  },
  gradeAnswer: {
    send: (gateway, socket, payload) =>
      gateway.handleGradeAnswer(asSocket(socket), payload),
    payload: () => ({ answerId: 1, pointsAwarded: 1 }),
  },
  kickTeam: {
    send: (gateway, socket, payload) =>
      gateway.handleKickTeam(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId }),
  },
  leaveSession: {
    send: (gateway, socket, payload) =>
      gateway.handleLeaveSession(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId }),
  },
  setBreakEndTime: {
    send: (gateway, socket, payload) =>
      gateway.handleSetBreakEndTime(asSocket(socket), payload),
    payload: () => ({ breakEndsAt: null }),
  },
  setDisplayTextScale: {
    send: (gateway, socket, payload) =>
      gateway.handleSetDisplayTextScale(asSocket(socket), payload),
    payload: () => ({ displayTextScale: DISPLAY_TEXT_SCALE_STEPS[0] }),
  },
  awardBonus: {
    send: (gateway, socket, payload) =>
      gateway.handleAwardBonus(asSocket(socket), payload),
    payload: ({ teamId }) => ({ teamId, category: 'custom', points: 1 }),
  },
  createShowdownRound: {
    send: (gateway, socket, payload) =>
      gateway.handleCreateShowdownRound(asSocket(socket), payload),
    payload: () => ({ question: 'How many?', answer: '42', points: 1 }),
  },
  submitShowdownGuess: {
    send: (gateway, socket, payload) =>
      gateway.handleSubmitShowdownGuess(asSocket(socket), payload),
    payload: ({ teamId }) => ({ showdownRoundId: 1, teamId, value: '42' }),
  },
};

interface EventCase extends EventSender {
  name: string;
  allowedRoom: SocketRoomName;
  rejection: string;
}

const EVENT_CASES: EventCase[] = Object.entries(D).map(
  ([key, declaration]) => ({
    name: declaration.event,
    allowedRoom: declaration.allowedRoom,
    rejection: declaration.rejection,
    ...SENDERS[key as keyof typeof D],
  }),
);

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

  it('declares every client-to-server socket event once, with a sender here', () => {
    const clientEvents = Object.values(SOCKET_EVENTS).filter((event) =>
      EVENT_CASES.some((declared) => declared.name === event),
    );
    expect(new Set(EVENT_CASES.map((event) => event.name)).size).toBe(
      EVENT_CASES.length,
    );
    expect(clientEvents).toHaveLength(EVENT_CASES.length);
    expect(Object.keys(SENDERS).sort()).toEqual(Object.keys(D).sort());
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

  describe('team-owned events', () => {
    let intruder: MockSocket;

    beforeEach(async () => {
      intruder = await game.connectPlayer();
      game.clearEmits();
    });

    it('refuses submitAnswer from a socket that does not own the seat', async () => {
      const result = await game.gateway.handleSubmitAnswer(asSocket(intruder), {
        questionId: ids.questionId,
        teamId: ids.teamId,
        value: 'Paris',
      });

      expect(result).toEqual({
        success: false,
        error: 'You may only submit answers for your own team',
      });
      expectNothingDelivered();
    });

    it('refuses leaveSession from a socket that does not own the seat', async () => {
      const result = await game.gateway.handleLeaveSession(asSocket(intruder), {
        teamId: ids.teamId,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining(
          'Can only leave the session as your own team',
        ) as string,
      });
      expectNothingDelivered();
    });
  });
});

describe('GameGateway — showdown guess seat ownership', () => {
  const harness = setupRealStoreGatewayTest();

  it('refuses submitShowdownGuess from a socket that does not own the seat', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B'],
    });
    await tieOnFirstQuestion(game, game.teams);
    const admin = await game.connectAdmin();
    await game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many?',
      answer: '100',
      points: 5,
    });
    const { activeShowdown } = await game.snapshot();
    const intruder = await game.connectPlayer();
    game.clearEmits();

    const result = await game.gateway.handleSubmitShowdownGuess(
      asSocket(intruder),
      {
        showdownRoundId: activeShowdown!.id,
        teamId: game.teams[0].teamId,
        value: '95',
      },
    );

    expect(result).toEqual({
      success: false,
      error: 'You may only submit guesses for your own team',
    });
    expect(game.roomEmits()).toEqual([]);
  });
});
