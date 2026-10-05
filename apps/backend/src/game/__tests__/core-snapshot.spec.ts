import { GameStateService } from '@/game/state/game-state.service';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameStateService — core snapshot', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      game.seedService,
      game.progressRepository,
      game.orm,
      game.answerService,
      game.standingsService,
      game.showdownService,
      game.teamService,
    );

    await expect(
      uninitialized.applyAction(game.joinCode, 'START_QUIZ'),
    ).rejects.toThrow(/before initialization/i);
  });

  it('exposes the seeded game session id', () => {
    expect(game.gameState.getGameSessionId(game.joinCode)).toBe(
      game.gameSessionId,
    );
  });

  it('includes the session join code in the snapshot', async () => {
    expect((await game.snapshot()).joinCode).toBe(game.joinCode);
  });

  it('summarizes the active quiz structure (blocks and topics per block) in the snapshot', async () => {
    // round-1 (no break) + round-2 (breakAfter) = 1 block of 2 topics.
    expect((await game.snapshot()).quizStructure).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
      breakRoundNumbers: [2],
      minQuestionsPerTopic: 2,
      maxQuestionsPerTopic: 2,
    });
  });

  it('starts with no connected teams in the snapshot', async () => {
    expect((await game.snapshot()).teams).toEqual([]);
  });

  it('reflects a joined team in the snapshot, connected until its socket drops', async () => {
    const { socket, teamId } = await game.joinTeam('The Quizzards');
    expect((await game.snapshot()).teams).toEqual([
      { teamId, teamName: 'The Quizzards', isConnected: true },
    ]);

    await game.gateway.handleDisconnect(asSocket(socket));

    expect((await game.snapshot()).teams).toEqual([
      { teamId, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('clears the connected teams when a new quiz session is selected', async () => {
    await game.joinTeam('The Quizzards');

    const snapshot = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    expect(snapshot.teams).toEqual([]);
  });
});
