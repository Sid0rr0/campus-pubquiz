import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  type AckResult,
  type SessionSettings,
  type TeamPurchasesSyncedPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceToBlockBoard,
  advanceUntil,
  setupRealStoreGatewayTest,
  submitAnswers,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const THREE_ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
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

const COST = DEFAULT_SESSION_SETTINGS.powerUps.extra_joker.cost;

describe('GameGateway — buying an extra joker', () => {
  const harness = setupRealStoreGatewayTest();

  async function night(
    settings: Partial<SessionSettings> = {},
    { maxUses = 3, rounds = THREE_ROUNDS } = {},
  ) {
    const game = await harness.createGateway({
      rounds,
      teamNames: ['Alpha', 'Bravo'],
      settings: {
        powerUpsEnabled: true,
        startingCoins: 10,
        ...settings,
        powerUps: {
          ...DEFAULT_SESSION_SETTINGS.powerUps,
          extra_joker: { cost: COST, maxUses },
        },
      },
    });
    await game.act('START_QUIZ');
    return game;
  }

  function buy(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
    roundIndex: number,
  ): Promise<AckResult> {
    return game.gateway.handleBuyPowerUp(asSocket(team.socket), {
      powerUp: 'extra_joker',
      roundId: game.rounds[roundIndex].id,
    });
  }

  async function refusal(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
    roundIndex: number,
  ): Promise<string> {
    const ack = await buy(game, team, roundIndex);
    if (ack.success) throw new Error('expected a refusal');
    return ack.error ?? '';
  }

  function stored(game: RealStoreGateway, team: JoinedTeam) {
    return game.inRequestContext(() =>
      game.purchaseService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  async function totals(game: RealStoreGateway) {
    const { leaderboard } = await game.snapshot();
    return Object.fromEntries(
      leaderboard.map((row) => [row.teamName, row.totalPoints]),
    );
  }

  describe('naming the doubled round to the buying team', () => {
    function lastSync(game: RealStoreGateway, team: JoinedTeam) {
      return game
        .roomEmits()
        .filter(
          (emit) =>
            emit.rooms.includes(team.socket.id) &&
            emit.event === SOCKET_EVENTS.TEAM_PURCHASES_SYNCED,
        )
        .map((emit) => emit.payload as TeamPurchasesSyncedPayload)
        .at(-1);
    }

    it('sends the round number and title with the round overview on air', async () => {
      const game = await night({ showRoundOverview: true });
      const [alpha] = game.teams;
      await game.act('ADVANCE'); // rules -> round_overview

      await buy(game, alpha, 0);

      expect(lastSync(game, alpha)?.purchases).toMatchObject([
        { round: { roundNumber: 1, title: 'Round 1' } },
      ]);
    });

    it('keeps the title back before the round overview has aired, as the offer does', async () => {
      const game = await night({ showRoundOverview: true });
      const [alpha] = game.teams;

      await buy(game, alpha, 0);

      expect(lastSync(game, alpha)?.purchases).toMatchObject([
        { round: { roundNumber: 1, title: '' } },
      ]);
    });

    it('keeps the title back with the round overview off, as the offer does', async () => {
      const game = await night({ showRoundOverview: false });
      const [alpha] = game.teams;

      await buy(game, alpha, 0);

      expect(lastSync(game, alpha)?.purchases).toMatchObject([
        { round: { roundNumber: 1, title: '' } },
      ]);
    });
  });

  describe('the purchase window', () => {
    it('sells the next round at any point before its intro, mid-block included, and stores the round', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await advanceUntil(game, 'question_open'); // round 1 is open

      const ack = await buy(game, alpha, 1);

      expect(ack).toEqual({ success: true });
      expect(await stored(game, alpha)).toMatchObject([
        {
          powerUp: 'extra_joker',
          questionId: null,
          roundId: game.rounds[1].id,
          cost: COST,
        },
      ]);
    });

    it('refuses a round that is not the next one, or has started', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await advanceUntil(game, 'question_open');

      expect(await refusal(game, alpha, 2)).toMatch(/next round/);
      expect(await refusal(game, alpha, 0)).toMatch(/next round/);
    });

    it('closes once the next round intro is on air', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await advanceUntil(game, 'round_intro');
      await advanceToBlockBoard(game);
      await advanceUntil(game, 'round_intro'); // round 2 intro

      expect(await refusal(game, alpha, 1)).toMatch(/next round/);
      expect(await buy(game, alpha, 2)).toEqual({ success: true });
    });

    it.each(['locking', 'break_intro'] as const)(
      'offers no round whose intro has passed, in %s',
      async (status) => {
        const game = await night();
        const [alpha] = game.teams;
        await advanceUntil(game, status);

        expect(await refusal(game, alpha, 0)).toMatch(/next round/);
        expect(await buy(game, alpha, 1)).toEqual({ success: true });
      },
    );

    it('refuses the joker round', async () => {
      const game = await night({
        showRoundOverview: true,
        jokersEnabled: true,
      });
      const [alpha] = game.teams;
      await game.act('ADVANCE'); // -> round_overview
      await game.act('ADVANCE'); // -> joker_pick
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[1].id,
      });
      await advanceUntil(game, 'question_open'); // round 1 open, round 2 next

      expect(await refusal(game, alpha, 1)).toMatch(/already doubled/);
    });
  });

  describe('scoring', () => {
    it('doubles the answer points of the round for the buying team only', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await buy(game, alpha, 0);
      await advanceUntil(game, 'question_open');
      await submitAnswers(game, ['right', 'right']);
      await advanceToBlockBoard(game);

      expect(await totals(game)).toEqual({ Alpha: 2, Bravo: 1 });
      const { leaderboard } = await game.snapshot();
      const row = leaderboard.find((r) => r.teamName === 'Alpha')!;
      expect(row.roundPoints[0]).toMatchObject({ points: 2, isJoker: true });
    });

    it('moves the totals when the answer key is fixed', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await buy(game, alpha, 0);
      await advanceUntil(game, 'question_open');
      await submitAnswers(game, ['right', 'right']);
      await advanceToBlockBoard(game);

      await game.saveAnswerKeyFix(game.rounds[0].questionIds[0], { points: 3 });

      expect(await totals(game)).toEqual({ Alpha: 6, Bravo: 3 });
    });
  });

  it('refuses an extra joker for a quickfire round', async () => {
    const game = await night(
      {},
      {
        rounds: THREE_ROUNDS.map((round) => ({ ...round, quickfire: true })),
      },
    );
    const [alpha] = game.teams;

    expect(await refusal(game, alpha, 0)).toMatch(/next round/);
    expect(await stored(game, alpha)).toEqual([]);
  });

  describe('default cost in the lobby', () => {
    const costAfter = async (
      settings: Partial<SessionSettings>,
      partial: Partial<SessionSettings>,
    ) => {
      const game = await harness.createGateway({ settings });
      await game.inRequestContext(() =>
        game.gameState.updateSessionSettings(game.joinCode, partial),
      );
      return game.gameState.getSnapshot(game.joinCode).settings.powerUps
        .extra_joker.cost;
    };

    it('follows a settings patch that changes only the round overview', async () => {
      expect(await costAfter({}, { showRoundOverview: true })).toBe(6);
    });

    it('keeps the cost of a patch that sets the power-ups together with the overview', async () => {
      const powerUps = {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 7, maxUses: 1 },
      };
      expect(await costAfter({}, { showRoundOverview: true, powerUps })).toBe(
        7,
      );
    });

    it('keeps the cost of a patch that sets only the power-ups', async () => {
      const powerUps = {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 7, maxUses: 1 },
      };
      expect(await costAfter({}, { powerUps })).toBe(7);
    });

    it('stays where the quiz master put it', async () => {
      const powerUps = {
        ...DEFAULT_SESSION_SETTINGS.powerUps,
        extra_joker: { cost: 9, maxUses: 1 },
      };
      expect(await costAfter({ powerUps }, { showRoundOverview: true })).toBe(
        9,
      );
    });
  });

  describe('joker round changes', () => {
    async function withExtraOnRoundOne() {
      const game = await night({
        showRoundOverview: true,
        jokersEnabled: true,
      });
      const [alpha] = game.teams;
      await buy(game, alpha, 0);
      await game.act('ADVANCE'); // -> round_overview
      await game.act('ADVANCE'); // -> joker_pick
      return { game, alpha };
    }

    it('cannot be stacked by the team picking the same round', async () => {
      const { game, alpha } = await withExtraOnRoundOne();

      const ack = await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[0].id,
      });

      expect(ack).toEqual({
        success: false,
        error: 'That round is already doubled by an extra joker',
      });
    });

    it('cannot be stacked by the quiz master setting the same round', async () => {
      const { game, alpha } = await withExtraOnRoundOne();
      const admin = await game.connectAdmin();

      const ack = await game.gateway.handleSetTeamJoker(asSocket(admin), {
        teamId: alpha.teamId,
        roundId: game.rounds[0].id,
      });

      expect(ack).toEqual({
        success: false,
        error: 'That round is already doubled by an extra joker',
      });
    });

    it('never draws the doubled round for a team that did not pick', async () => {
      const game = await harness.createGateway({
        rounds: THREE_ROUNDS,
        teamNames: ['Alpha'],
        jokerRandom: () => 0, // always the first round still drawable
        settings: {
          powerUpsEnabled: true,
          startingCoins: 10,
          showRoundOverview: true,
          jokersEnabled: true,
        },
      });
      await game.act('START_QUIZ');
      await buy(game, game.teams[0], 0);
      await game.act('ADVANCE'); // -> round_overview
      await game.act('ADVANCE'); // -> joker_pick
      await game.act('ADVANCE'); // the pick closes, Alpha is dealt a joker

      const joker = await game.inRequestContext(() =>
        game.jokerService.listForSession(game.gameSessionId),
      );
      expect([...joker]).toEqual([
        [game.teams[0].teamId, { roundId: game.rounds[1].id, source: 'drawn' }],
      ]);
    });
  });
});
