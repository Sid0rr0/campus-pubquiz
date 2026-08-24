import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import type { GameStateService } from '@/game/state/game-state.service';
import {
  TEST_SESSION_TOKEN,
  createFakeGameStateSeedService,
  createMockSocket,
  createTestGateway,
  asSocket,
  type MockServer,
  type MockAnswerService,
} from './test-utils';

/** Drives ADVANCE until the session reaches the given status, or throws after a generous cap. */
async function advanceUntilStatus(
  gateway: GameGateway,
  gameStateService: GameStateService,
  joinCode: string,
  admin: ReturnType<typeof createMockSocket>,
  status: string,
): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (gameStateService.getSnapshot(joinCode).progress.status === status) {
      return;
    }
    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' });
  }
  throw new Error(`Never reached status "${status}"`);
}

describe('GameGateway — team answers sync on reveal entry', () => {
  let gateway: GameGateway;
  let server: MockServer;
  let answerService: MockAnswerService;
  let gameStateService: GameStateService;

  beforeEach(async () => {
    // FIXTURE_SEEDED_GAME's single round has breakAfter: false and is the
    // only round, which the state machine rejects ("its answers could never
    // be revealed") — GAME_STATE_FIXTURE_SEEDED_GAME's second round has
    // breakAfter: true, so this game can legally reach reveal.
    ({ gateway, server, answerService, gameStateService } =
      await createTestGateway(createFakeGameStateSeedService()));
  });

  it("pushes the team's own answers privately once the block reaches reveal_intro", async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, 'socket-player');
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-admin',
    );
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    await advanceUntilStatus(
      gateway,
      gameStateService,
      'ABCDEF',
      admin,
      'reveal_intro',
    );

    expect(answerService.listForTeam).toHaveBeenCalledWith(101, 31);
    expect(server.to).toHaveBeenCalledWith('socket-player');
    expect(server.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      {
        answers: [
          {
            questionId: 21,
            value: 'Banana',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      },
    );
  });

  it('does not push to a team that is not currently connected', async () => {
    const admin = createMockSocket(SOCKET_ROOMS.ADMIN, {
      token: TEST_SESSION_TOKEN,
    });
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });

    await advanceUntilStatus(
      gateway,
      gameStateService,
      'ABCDEF',
      admin,
      'reveal_intro',
    );

    expect(answerService.listForTeam).not.toHaveBeenCalled();
    expect(server.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      expect.anything(),
    );
  });

  it('does not push again on a later ADVANCE while already revealing', async () => {
    const player = createMockSocket(SOCKET_ROOMS.PLAYERS, {}, 'socket-player');
    await gateway.handleConnection(asSocket(player));
    await gateway.handleJoinPlayers(asSocket(player), {
      teamName: 'The Quizzards',
    });
    const admin = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'socket-admin',
    );
    await gateway.handleConnection(asSocket(admin));
    await gateway.handleAdminAction(asSocket(admin), { action: 'START_QUIZ' });
    await advanceUntilStatus(
      gateway,
      gameStateService,
      'ABCDEF',
      admin,
      'reveal_intro',
    );
    answerService.listForTeam.mockClear();
    server.to.mockClear();
    server.emit.mockClear();

    await gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' }); // -> reveal

    expect(answerService.listForTeam).not.toHaveBeenCalled();
    expect(server.emit).not.toHaveBeenCalledWith(
      SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      expect.anything(),
    );
  });
});
