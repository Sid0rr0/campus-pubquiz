import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  type AckResult,
  type AnswersUpdatedPayload,
  type PowerUpId,
  type PowerUpSettings,
  type SessionSettings,
  type TeamPurchasesSyncedPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const OPTIONS = ['Paris', 'London', 'Berlin', 'Rome'];

const QUIZ: QuizRoundSpec[] = [
  {
    title: 'Round 1',
    breakAfter: true,
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        payload: { options: OPTIONS },
      },
      {
        type: 'multiple_choice',
        prompt: 'Capital of Italy?',
        answer: 'Rome',
        points: 2,
        payload: { options: OPTIONS },
      },
      {
        type: 'multiple_choice',
        prompt: 'Heads or tails?',
        answer: 'Heads',
        points: 1,
        payload: { options: ['Heads', 'Tails'] },
      },
      { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
    ],
  },
];

function powerUps(
  fiftyFifty: Partial<PowerUpSettings['fifty_fifty']>,
): PowerUpSettings {
  return {
    ...DEFAULT_SESSION_SETTINGS.powerUps,
    fifty_fifty: { cost: 1, maxUses: 1, ...fiftyFifty },
  };
}

describe('GameGateway — buying a 50/50', () => {
  const harness = setupRealStoreGatewayTest();

  async function night(
    settings: Partial<SessionSettings> = {},
    options: CreateGatewayOptions = {},
  ) {
    const game = await harness.createGateway({
      rounds: QUIZ,
      teamNames: ['Alpha', 'Bravo'],
      settings: { powerUpsEnabled: true, startingCoins: 3, ...settings },
      ...options,
    });
    await game.openFirstQuestion(await game.connectAdmin());
    return game;
  }

  /** Question ids of the quiz, in order: France, Italy, two options, planet. */
  function ids(game: RealStoreGateway) {
    const [france, italy, coin, planet] = game.rounds[0].questionIds;
    return { france, italy, coin, planet };
  }

  function buy(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
    questionId: number,
    powerUp: PowerUpId = 'fifty_fifty',
  ): Promise<AckResult> {
    return game.gateway.handleBuyPowerUp(asSocket(team.socket), {
      powerUp,
      questionId,
    });
  }

  function syncsTo(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
  ): TeamPurchasesSyncedPayload[] {
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(team.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_PURCHASES_SYNCED,
      )
      .map((emit) => emit.payload as TeamPurchasesSyncedPayload);
  }

  function storedPurchases(game: RealStoreGateway, team: JoinedTeam) {
    return game.inRequestContext(() =>
      game.purchaseService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  function joinedWith(socket: JoinedTeam['socket']) {
    const accepted = socket.emit.mock.calls.filter(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, { purchases: unknown; coins: number }][];
    return accepted[accepted.length - 1][1];
  }

  describe('a purchase that goes through', () => {
    it('removes half the options, keeps the right one, and tells only the buying team', async () => {
      const game = await night();
      const [alpha, bravo] = game.teams;
      const { france } = ids(game);
      game.clearEmits();

      const ack = await buy(game, alpha, france);

      expect(ack).toEqual({ success: true });
      const [sync] = syncsTo(game, alpha);
      expect(sync.coins).toBe(2);
      expect(sync.purchases).toHaveLength(1);
      const [purchase] = sync.purchases;
      expect(purchase).toMatchObject({
        powerUp: 'fifty_fifty',
        questionId: france,
        roundId: null,
      });
      if (purchase.effect.kind !== 'fifty_fifty')
        throw new Error('not a 50/50');
      const removed = purchase.effect.removedOptions;
      expect(removed).toHaveLength(2);
      expect(removed).not.toContain('Paris');
      expect(removed.every((option) => OPTIONS.includes(option))).toBe(true);
      expect(syncsTo(game, bravo)).toEqual([]);
    });

    it('draws the removed options with the random source, once', async () => {
      const game = await night({}, { jokerRandom: () => 0 });
      const [alpha] = game.teams;

      await buy(game, alpha, ids(game).france);

      const [stored] = await storedPurchases(game, alpha);
      expect(stored.effect).toEqual({
        kind: 'fifty_fifty',
        removedOptions: ['London', 'Berlin'],
      });
      expect(stored.cost).toBe(1);
    });

    it('stores the first letter and the letter count of a free-text key', async () => {
      const game = await night();
      const [alpha] = game.teams;
      const { planet } = ids(game);
      for (let i = 0; i < 3; i += 1) await game.act('ADVANCE');

      expect(await buy(game, alpha, planet, 'first_letter')).toEqual({
        success: true,
      });
      expect(await buy(game, alpha, planet, 'letter_count')).toEqual({
        success: true,
      });

      const stored = await storedPurchases(game, alpha);
      expect(stored.map((p) => p.effect)).toEqual([
        { kind: 'first_letter', hint: 'J' },
        { kind: 'letter_count', hint: '_______' },
      ]);
    });

    it('takes the cost from the balance on the phone and on /control', async () => {
      const game = await night(
        { powerUps: powerUps({ cost: 2 }) },
        { jokerRandom: () => 0 },
      );
      const [alpha] = game.teams;

      await buy(game, alpha, ids(game).france);

      const view = await game.snapshot();
      expect(
        Object.fromEntries(view.teams.map((t) => [t.teamName, t.coins])),
      ).toEqual({ Alpha: 1, Bravo: 3 });
    });

    it('spends coin awards too: the balance is the one ledger, awards minus purchases', async () => {
      const game = await night({ startingCoins: 0 });
      const [alpha] = game.teams;
      const admin = await game.connectAdmin();
      await game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: alpha.teamId,
        category: 'custom',
        points: 0,
        coins: 2,
      });
      game.clearEmits();

      await buy(game, alpha, ids(game).france);

      expect(syncsTo(game, alpha)[0].coins).toBe(1);
      const view = await game.snapshot();
      expect(view.teams.find((t) => t.teamName === 'Alpha')?.coins).toBe(1);
    });

    it('survives a reconnect and a backend restart: the join reply carries the same effect and coins', async () => {
      const game = await night({}, { jokerRandom: () => 0.5 });
      const [alpha] = game.teams;
      await buy(game, alpha, ids(game).france);
      const [before] = await storedPurchases(game, alpha);

      const secondDevice = await game.connectPlayer();
      await game.gateway.handleJoinPlayers(asSocket(secondDevice), {
        teamName: 'Alpha',
        teamToken: alpha.teamToken,
        joinCode: game.joinCode,
        previousSocketId: alpha.socket.id,
      });
      const reply = joinedWith(secondDevice);

      expect(reply.coins).toBe(2);
      expect(reply.purchases).toEqual([
        {
          powerUp: 'fifty_fifty',
          questionId: ids(game).france,
          roundId: null,
          effect: before.effect,
        },
      ]);

      const restarted = await game.restart();
      const [again] = await restarted.inRequestContext(() =>
        restarted.purchaseService.listForTeam(
          restarted.gameSessionId,
          alpha.teamId,
        ),
      );
      expect(again.effect).toEqual(before.effect);
    });

    it('is shown to the quiz master on the team’s answer', async () => {
      const game = await night();
      const [alpha, bravo] = game.teams;
      const { france } = ids(game);
      for (const team of [alpha, bravo]) {
        await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
          questionId: france,
          teamId: team.teamId,
          value: 'Paris',
        });
      }
      game.clearEmits();

      await buy(game, alpha, france);
      await game.settled();

      const [update] = game.payloadsTo<AnswersUpdatedPayload>(
        'admin',
        SOCKET_EVENTS.ANSWERS_UPDATED,
      );
      expect(
        Object.fromEntries(update.answers.map((a) => [a.teamName, a.powerUps])),
      ).toEqual({ Alpha: ['fifty_fifty'], Bravo: [] });
      const franceList = await game.inRequestContext(() =>
        game.answerService.listForQuestion(game.gameSessionId, france),
      );
      expect(
        Object.fromEntries(franceList.map((a) => [a.teamName, a.powerUps])),
      ).toEqual({ Alpha: ['fifty_fifty'], Bravo: [] });
    });

    it('lets the big screen count it at the reveal without naming a team', async () => {
      const game = await night();
      const [alpha, bravo] = game.teams;
      const { france } = ids(game);
      await buy(game, alpha, france);
      await buy(game, bravo, france);
      await game.act('ADVANCE'); // second question
      await game.act('ADVANCE'); // third
      await game.act('ADVANCE'); // fourth
      await game.act('ADVANCE'); // lock
      let display = await game.resync('display');
      while (display.progress.status !== 'reveal') {
        await game.act('ADVANCE');
        display = await game.resync('display');
      }

      expect(display.powerUpCounts).toEqual([
        { powerUp: 'fifty_fifty', count: 2 },
      ]);
      expect(JSON.stringify(display.powerUpCounts)).not.toMatch(/Alpha|Bravo/);
    });
  });

  describe('buying Ask the room', () => {
    async function room() {
      const game = await night({}, { teamNames: ['A', 'B', 'C', 'D'] });
      const { france } = ids(game);
      const answer = (team: JoinedTeam, value: string) =>
        game.gateway.handleSubmitAnswer(asSocket(team.socket), {
          questionId: france,
          teamId: team.teamId,
          value,
        });
      return { game, france, answer, teams: game.teams };
    }

    it('is refused until three other teams have a current answer, and costs nothing', async () => {
      const { game, france, answer, teams } = await room();
      const [a, b, c] = teams;
      await answer(a, 'Paris'); // the buyer's own answer never counts
      await answer(b, 'Paris');
      await answer(c, 'Rome');

      const ack = await buy(game, a, france, 'ask_the_room');

      expect(ack).toEqual({
        success: false,
        error: 'Waiting for more answers',
      });
      expect(await storedPurchases(game, a)).toEqual([]);
    });

    it('stores the split without the buyer, and the split survives a rejoin', async () => {
      const { game, france, answer, teams } = await room();
      const [a, b, c, d] = teams;
      await answer(a, 'London');
      await answer(b, 'Paris');
      await answer(c, 'Paris');
      await answer(d, 'Rome');
      game.clearEmits();

      expect(await buy(game, a, france, 'ask_the_room')).toEqual({
        success: true,
      });
      await answer(b, 'Berlin'); // later answers don't move the stored split

      const expected = {
        kind: 'ask_the_room',
        split: { Paris: 67, London: 0, Berlin: 0, Rome: 33 },
      };
      expect(syncsTo(game, a)[0].purchases[0].effect).toEqual(expected);
      expect(syncsTo(game, a)[0].coins).toBe(1);
      const second = await game.connectPlayer();
      await game.gateway.handleJoinPlayers(asSocket(second), {
        teamName: 'A',
        teamToken: a.teamToken,
        joinCode: game.joinCode,
        previousSocketId: a.socket.id,
      });
      expect(joinedWith(second).purchases).toMatchObject([
        { powerUp: 'ask_the_room', effect: expected },
      ]);
    });
  });

  describe('a refused purchase', () => {
    async function refusal(
      game: RealStoreGateway,
      team: JoinedTeam,
      questionId: number,
    ): Promise<string> {
      const ack = await buy(game, team, questionId);
      if (ack.success) throw new Error('expected a refusal');
      return ack.error;
    }

    it('refuses a power-up the session does not offer', async () => {
      const game = await night({ powerUps: powerUps({ maxUses: 0 }) });
      const [alpha] = game.teams;

      expect(await refusal(game, alpha, ids(game).france)).toMatch(
        /not offered/,
      );
      expect(await storedPurchases(game, alpha)).toEqual([]);
    });

    it('refuses once the per-session limit is used up', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await buy(game, alpha, ids(game).france);
      await game.act('ADVANCE'); // opens the second question

      expect(await refusal(game, alpha, ids(game).italy)).toMatch(/limit/);
      expect(await storedPurchases(game, alpha)).toHaveLength(1);
    });

    it('refuses a second use on the same question', async () => {
      const game = await night({ powerUps: powerUps({ maxUses: 2 }) });
      const [alpha] = game.teams;
      await buy(game, alpha, ids(game).france);

      expect(await refusal(game, alpha, ids(game).france)).toMatch(/already/);
      expect(await storedPurchases(game, alpha)).toHaveLength(1);
    });

    it('refuses when the balance is below the cost', async () => {
      const game = await night({ startingCoins: 0 });
      const [alpha] = game.teams;

      expect(await refusal(game, alpha, ids(game).france)).toMatch(/coins/);
      expect(await storedPurchases(game, alpha)).toEqual([]);
    });

    it('refuses with power-ups off and no coin', async () => {
      const game = await night({ powerUpsEnabled: false });
      const [alpha] = game.teams;

      expect(await refusal(game, alpha, ids(game).france)).toMatch(/coins/);
    });

    it('lets a team spend its carried coin with power-ups off, from the session table', async () => {
      const game = await harness.createGateway({
        rounds: QUIZ,
        teamNames: ['Alpha'],
        settings: { powerUpsEnabled: false, startingCoins: 3 },
      });
      jest
        .spyOn(game.carriedCoinService, 'decide')
        .mockImplementation((_, teamIds) =>
          Promise.resolve(Object.fromEntries(teamIds.map((id) => [id, 1]))),
        );
      await game.openFirstQuestion(await game.connectAdmin());
      const [alpha] = game.teams;
      game.clearEmits();

      expect(await buy(game, alpha, ids(game).france)).toEqual({
        success: true,
      });
      expect(syncsTo(game, alpha)).toMatchObject([{ coins: 0 }]);
    });

    it('refuses a question that is not open or already locked', async () => {
      const game = await night();
      const [alpha] = game.teams;
      const { planet } = ids(game);
      // The block opens question by question: the fourth is not open yet.
      expect(await refusal(game, alpha, planet)).toMatch(/locked/);
      while ((await game.resync('players')).isAnswerable) {
        await game.act('ADVANCE');
      }
      expect(await refusal(game, alpha, ids(game).france)).toMatch(/locked/);
      expect(await storedPurchases(game, alpha)).toEqual([]);
    });

    it('refuses a question a 50/50 does not work on', async () => {
      const game = await night();
      const [alpha] = game.teams;
      await game.act('ADVANCE');
      await game.act('ADVANCE');
      await game.act('ADVANCE');

      // Two options: not offered.
      expect(await refusal(game, alpha, ids(game).coin)).toMatch(
        /does not work/,
      );
      // Typed answer.
      expect(await refusal(game, alpha, ids(game).planet)).toMatch(
        /does not work/,
      );
      expect(await storedPurchases(game, alpha)).toEqual([]);
    });

    it('refuses a socket that holds no team seat', async () => {
      const game = await night();
      const stranger = await game.connectPlayer();

      const ack = await buy(game, { socket: stranger }, ids(game).france);

      expect(ack.success).toBe(false);
    });

    it('rejects a malformed payload before touching any state', async () => {
      const game = await night();
      const [alpha] = game.teams;

      await expect(
        game.gateway.handleBuyPowerUp(asSocket(alpha.socket), {
          powerUp: 'nope',
          questionId: 1,
        }),
      ).resolves.toMatchObject({ success: false });
      expect(await storedPurchases(game, alpha)).toEqual([]);
    });
  });
});
