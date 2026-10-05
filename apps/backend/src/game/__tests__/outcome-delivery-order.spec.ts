import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SOCKET_CLOSED = 'socket closed';

const ROOM_PUSH = [
  SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
  SOCKET_EVENTS.STATE_UPDATED,
  SOCKET_EVENTS.STATE_UPDATED,
  SOCKET_EVENTS.STATE_UPDATED,
];

/**
 * Records, in the order they happen, every emit a client could observe —
 * direct emits on `senders`, every server emit — and every closed socket.
 */
function recordDeliveryOrder(
  game: RealStoreGateway,
  senders: readonly MockSocket[],
): string[] {
  const log: string[] = [];
  const emitToRooms = game.server.emit.getMockImplementation();
  game.server.emit.mockImplementation((event: string, payload: unknown) => {
    log.push(event);
    emitToRooms?.(event, payload);
    return true;
  });
  for (const socket of senders) {
    socket.emit.mockImplementation((event: string) => {
      log.push(event);
    });
    socket.disconnect.mockImplementation(() => {
      log.push(SOCKET_CLOSED);
      socket.connected = false;
    });
  }
  return log;
}

describe('GameGateway — outcome delivery order', () => {
  const harness = setupRealStoreGatewayTest();

  it('sends the answer reply to the sender before any room push, then the admin answer list', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const [{ socket, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    const log = recordDeliveryOrder(game, [socket]);

    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });

    expect(log).toEqual([
      SOCKET_EVENTS.ANSWER_RECEIVED,
      ...ROOM_PUSH,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    ]);
  });

  it('sends the join reply to the joining socket before the room push', async () => {
    const game = await harness.createGateway({ teamNames: [] });
    const socket = await game.connectPlayer();
    const log = recordDeliveryOrder(game, [socket]);

    await game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'Late Arrivals',
      joinCode: game.joinCode,
    });

    expect(log).toEqual([SOCKET_EVENTS.JOIN_ACCEPTED, ...ROOM_PUSH]);
  });

  it('sends the kicked notice after the room pushes and closes the socket last', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const [{ socket, teamId }] = game.teams;
    const log = recordDeliveryOrder(game, [socket]);

    await game.gateway.handleKickTeam(asSocket(admin), { teamId });

    expect(log).toEqual([
      ...ROOM_PUSH,
      SOCKET_EVENTS.TEAM_KICKED,
      SOCKET_CLOSED,
    ]);
  });

  it('turns a refused press into a socket error carrying the refusal message unchanged', async () => {
    const game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    const admin = await game.connectAdmin();
    const expected = await game.gameState
      .applyAdminAction(game.joinCode, 'PREVIOUS')
      .then(
        () => undefined,
        (error: Error) => error.message,
      );

    const ack = await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'PREVIOUS',
    });

    expect(expected).toEqual(expect.any(String));
    expect(ack).toEqual({ success: false, error: expected });
  });
});
