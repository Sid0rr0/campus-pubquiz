import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_ROOMS,
  type AckResult,
  type GameStatus,
  type PlayersStatePayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { GameSession } from '@/db/entities/game-session.entity';
import { SessionSettingsUpdateBlockedError } from '@/game/state/game-state.service';
import {
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const MAX_ADVANCES = 40;
const OFF_REASON = 'Feedback is off for this session';

const TWO_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Music',
    questions: [{ type: 'free_text', prompt: 'Q1', answer: 'a', points: 1 }],
  },
  {
    title: 'Film',
    breakAfter: true,
    questions: [{ type: 'free_text', prompt: 'Q2', answer: 'b', points: 1 }],
  },
];

async function advanceUntilStatus(
  game: RealStoreGateway,
  status: GameStatus,
): Promise<void> {
  let snapshot = await game.snapshot();
  for (let i = 0; i < MAX_ADVANCES; i += 1) {
    if (snapshot.progress.status === status) return;
    snapshot = await game.act('ADVANCE');
  }
  throw new Error(`Never reached status "${status}"`);
}

function playersView(game: RealStoreGateway): PlayersStatePayload {
  return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
}

function rate(
  game: RealStoreGateway,
  team: JoinedTeam,
  roundId: number,
): Promise<AckResult> {
  return game.gateway.handleRateRound(asSocket(team.socket), {
    roundId,
    stars: 4,
  });
}

function send(game: RealStoreGateway, team: JoinedTeam): Promise<AckResult> {
  return game.gateway.handleSendFeedback(asSocket(team.socket), {
    comment: 'Great night',
    topics: ['Geography'],
  });
}

describe('GameGateway — the "Collect feedback" session setting', () => {
  const harness = setupRealStoreGatewayTest();

  function createGame(collectFeedback: boolean): Promise<RealStoreGateway> {
    return harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: TWO_ROUNDS,
      settings: { collectFeedback },
    });
  }

  describe('when it is off', () => {
    it('lists no rounds in a break', async () => {
      const game = await createGame(false);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'break_intro');

      expect(playersView(game).feedback).toBeNull();
    });

    it('lists no rounds at ended', async () => {
      const game = await createGame(false);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'ended');

      expect(playersView(game).feedback).toBeNull();
    });

    it('refuses a rating with the "off" reason', async () => {
      const game = await createGame(false);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'break_intro');

      const ack = await rate(game, game.teams[0], game.rounds[0].id);

      expect(ack).toEqual({ success: false, error: OFF_REASON });
    });

    it('refuses Send with the "off" reason', async () => {
      const game = await createGame(false);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'ended');

      const ack = await send(game, game.teams[0]);

      expect(ack).toEqual({ success: false, error: OFF_REASON });
    });
  });

  describe('when it is on', () => {
    it('is on for a new session', async () => {
      const game = await harness.createGateway();

      expect(game.gameState.getSnapshot(game.joinCode).settings).toEqual(
        expect.objectContaining({ collectFeedback: true }),
      );
      expect(DEFAULT_SESSION_SETTINGS.collectFeedback).toBe(true);
    });

    it('still offers the break card and accepts a rating', async () => {
      const game = await createGame(true);
      await game.act('START_QUIZ');
      await advanceUntilStatus(game, 'break_intro');

      expect(playersView(game).feedback?.kind).toBe('break_card');
      expect(await rate(game, game.teams[0], game.rounds[0].id)).toEqual({
        success: true,
      });
    });
  });

  it('reads a stored settings JSON without the field as on', async () => {
    const game = await harness.createGateway({ rounds: TWO_ROUNDS });
    const legacySettings: Partial<typeof DEFAULT_SESSION_SETTINGS> = {
      ...DEFAULT_SESSION_SETTINGS,
    };
    delete legacySettings.collectFeedback;
    const em = game.orm.em.fork();
    const row = await em.findOneOrFail(GameSession, {
      joinCode: game.joinCode,
    });
    row.settings = legacySettings as typeof row.settings;
    await em.flush();

    const restarted = await game.restart();

    expect(
      restarted.gameState.getSnapshot(restarted.joinCode).settings
        .collectFeedback,
    ).toBe(true);
  });

  it('refuses changing it once the quiz has started', async () => {
    const game = await createGame(true);
    await game.act('START_QUIZ');

    await expect(
      game.inRequestContext(() =>
        game.gameState.updateSessionSettings(game.joinCode, {
          collectFeedback: false,
        }),
      ),
    ).rejects.toThrow(SessionSettingsUpdateBlockedError);
  });

  it('can be changed in the lobby', async () => {
    const game = await createGame(true);

    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        collectFeedback: false,
      }),
    );

    expect(
      game.gameState.getSnapshot(game.joinCode).settings.collectFeedback,
    ).toBe(false);
  });
});
