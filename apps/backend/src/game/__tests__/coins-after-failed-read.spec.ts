import { Logger } from '@nestjs/common';
import { DEFAULT_SESSION_SETTINGS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { teamViewsTo } from '@/game/__tests__/team-view-test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { StandingsService } from '@/standings/standings.service';

const ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

describe('Coins on the phone and the control panel after a failed Scoring records read', () => {
  const harness = setupRealStoreGatewayTest();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function night() {
    const game = await harness.createGateway({
      rounds: ROUNDS,
      teamNames: ['Alpha'],
      settings: {
        powerUpsEnabled: true,
        startingCoins: 5,
        powerUps: {
          ...DEFAULT_SESSION_SETTINGS.powerUps,
          extra_joker: { cost: 2, maxUses: 2 },
        },
      },
    });
    await game.act('START_QUIZ');
    return { game, alpha: game.teams[0] };
  }

  function failNextRead() {
    jest
      .spyOn(StandingsService.prototype, 'scoringRecords')
      .mockRejectedValueOnce(new Error('standings unavailable'));
  }

  function adminCoins(game: RealStoreGateway) {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN).teams[0]
      .coins;
  }

  function phoneCoins(
    game: RealStoreGateway,
    alpha: RealStoreGateway['teams'][number],
  ) {
    return teamViewsTo(game, alpha).at(-1)?.coins;
  }

  it('shows the same lower coins after a purchase whose read fails', async () => {
    const { game, alpha } = await night();
    game.clearEmits();
    failNextRead();

    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });

    expect(adminCoins(game)).toBe(3);
    expect(phoneCoins(game, alpha)).toBe(3);
  });

  it('shows the same balance after a coin award that follows a failed read', async () => {
    const { game, alpha } = await night();
    failNextRead();
    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });
    const admin = await game.connectAdmin();
    game.clearEmits();
    failNextRead();

    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: alpha.teamId,
      category: 'custom',
      points: 0,
      coins: 1,
    });

    expect(adminCoins(game)).toBe(4);
    expect(phoneCoins(game, alpha)).toBe(4);
  });

  it('shows the same refunded balance after a live edit refunds an extra joker and the read fails', async () => {
    const { game, alpha } = await night();
    await game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[0].id,
    });
    game.clearEmits();
    failNextRead();

    await game.saveQuizEdit((rounds) => [rounds[1], rounds[2]]);

    expect(adminCoins(game)).toBe(5);
    expect(phoneCoins(game, alpha)).toBe(5);
  });
});
