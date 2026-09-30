import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket, createMockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const ALL_ROOMS = [
  SOCKET_ROOMS.DISPLAY,
  SOCKET_ROOMS.ADMIN,
  SOCKET_ROOMS.PLAYERS,
];

describe('GameGateway — team presence (one live device per team + kick)', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  function expectStateUpdateInEveryRoom(): void {
    for (const room of ALL_ROOMS) {
      expect(
        game.payloadsTo(room, SOCKET_EVENTS.STATE_UPDATED).length,
      ).toBeGreaterThan(0);
    }
  }

  it('shows no connected team for a session nobody has joined', async () => {
    const { teams } = await game.snapshot();
    expect(teams).toEqual([]);
  });

  it('reflects isConnected in the snapshot once a team is connected', async () => {
    const { teamId } = await game.joinTeam('The Quizzards');

    const { teams } = await game.snapshot();
    expect(teams).toEqual([
      { teamId, teamName: 'The Quizzards', isConnected: true },
    ]);
  });

  it('broadcasts a state update to every room when a team connects', async () => {
    game.clearEmits();

    await game.joinTeam('The Quizzards');

    expectStateUpdateInEveryRoom();
  });

  it('frees a team connection when its socket disconnects, and broadcasts it', async () => {
    const { socket, teamId } = await game.joinTeam('The Quizzards');
    game.clearEmits();

    await game.gateway.handleDisconnect(asSocket(socket));

    expectStateUpdateInEveryRoom();
    const { teams } = await game.snapshot();
    expect(teams).toEqual([
      { teamId, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('has nothing to push when the disconnected socket is not connected to any team', async () => {
    const display = createMockSocket(
      SOCKET_ROOMS.DISPLAY,
      {},
      'display-1',
      game.joinCode,
    );
    await game.gateway.handleConnection(asSocket(display));
    game.clearEmits();

    await game.gateway.handleDisconnect(asSocket(display));

    expect(game.roomEmits()).toEqual([]);
  });

  it('does not disturb another team connection when an unrelated socket disconnects', async () => {
    const teamA = await game.joinTeam('The Quizzards');
    const teamB = await game.joinTeam('The Brainiacs');

    await game.gateway.handleDisconnect(asSocket(teamA.socket));

    const { teams } = await game.snapshot();
    expect(teams).toEqual([
      { teamId: teamA.teamId, teamName: 'The Quizzards', isConnected: false },
      { teamId: teamB.teamId, teamName: 'The Brainiacs', isConnected: true },
    ]);
  });

  it('does not carry a stale team connection over into a newly created session', async () => {
    await game.joinTeam('The Quizzards');

    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    expect(created.joinCode).not.toBe(game.joinCode);
    expect(created.teams).toEqual([]);
  });
});
