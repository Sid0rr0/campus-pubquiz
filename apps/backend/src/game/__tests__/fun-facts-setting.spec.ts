import {
  DEFAULT_SESSION_SETTINGS,
  type DisplayStatePayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { GameSession } from '@/db/entities/game-session.entity';
import { SessionSettingsUpdateBlockedError } from '@/game/state/game-state.service';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 20;

const TWO_BLOCKS: QuizRoundSpec[] = [1, 2].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1000,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

describe('Fun facts session setting', () => {
  const harness = setupRealStoreGatewayTest();

  async function displayView(
    game: RealStoreGateway,
  ): Promise<DisplayStatePayload> {
    return game.resync('display');
  }

  async function advanceUntil(
    game: RealStoreGateway,
    isReached: (view: DisplayStatePayload) => boolean,
  ) {
    for (let step = 0; step < MAX_ADVANCES; step += 1) {
      await game.act('ADVANCE');
      if (isReached(await displayView(game))) return;
    }
    throw new Error('The screen was never reached');
  }

  async function answerWrong(game: RealStoreGateway, roundIndex: number) {
    for (const { socket, teamId } of game.teams) {
      await game.gateway.handleSubmitAnswer(asSocket(socket), {
        questionId: game.rounds[roundIndex].questionIds[0],
        teamId,
        value: 'wrong',
      });
    }
  }

  /** Plays both blocks (nobody gets either) and returns the display view on the second break. */
  async function secondBreakView(
    game: RealStoreGateway,
  ): Promise<DisplayStatePayload> {
    await game.act('START_QUIZ');
    await advanceUntil(game, (v) => v.progress.status === 'question_open');
    await answerWrong(game, 0);
    await advanceUntil(
      game,
      (v) =>
        v.progress.status === 'question_open' && v.progress.roundIndex === 1,
    );
    await answerWrong(game, 1);
    await advanceUntil(game, (v) => v.onAirScreen.kind === 'break_intro');
    return displayView(game);
  }

  function createGame(settings?: { funFactsEnabled: boolean }) {
    return harness.createGateway({
      rounds: TWO_BLOCKS,
      teamNames: ['Team 1', 'Team 2'],
      ...(settings ? { settings } : {}),
    });
  }

  it('is on for a new session, so the break screen carries fun facts', async () => {
    const game = await createGame();

    const view = await secondBreakView(game);

    expect(DEFAULT_SESSION_SETTINGS.funFactsEnabled).toBe(true);
    expect(view.funFacts.length).toBeGreaterThan(0);
  });

  it('leaves funFacts empty on the break screen when it is off', async () => {
    const game = await createGame({ funFactsEnabled: false });

    const view = await secondBreakView(game);

    expect(view.onAirScreen.kind).toBe('break_intro');
    expect(view.funFacts).toEqual([]);
  });

  it('reads a stored settings JSON without the field as on', async () => {
    const game = await createGame();
    const legacySettings: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
      ...DEFAULT_SESSION_SETTINGS,
    };
    delete legacySettings.funFactsEnabled;
    const em = game.orm.em.fork();
    const row = await em.findOneOrFail(GameSession, {
      joinCode: game.joinCode,
    });
    row.settings = legacySettings as typeof row.settings;
    await em.flush();

    const restarted = await game.restart();

    expect(
      restarted.gameState.getSnapshot(restarted.joinCode).settings
        .funFactsEnabled,
    ).toBe(true);
  });

  it('can be changed in the lobby', async () => {
    const game = await createGame();

    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        funFactsEnabled: false,
      }),
    );

    expect(
      game.gameState.getSnapshot(game.joinCode).settings.funFactsEnabled,
    ).toBe(false);
  });

  it('refuses changing it once the quiz has started', async () => {
    const game = await createGame();
    await game.act('START_QUIZ');

    await expect(
      game.inRequestContext(() =>
        game.gameState.updateSessionSettings(game.joinCode, {
          funFactsEnabled: false,
        }),
      ),
    ).rejects.toThrow(SessionSettingsUpdateBlockedError);
  });
});
