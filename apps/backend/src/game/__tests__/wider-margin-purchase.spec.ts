import { SOCKET_EVENTS, type TeamAnswerView } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — buying a wider margin', () => {
  const harness = setupRealStoreGatewayTest();

  async function night() {
    const game = await harness.createGateway({
      teamNames: ['Wide', 'Plain'],
      settings: { powerUpsEnabled: true, startingCoins: 3 },
      rounds: [
        {
          title: 'Estimation',
          breakAfter: true,
          questions: [
            {
              type: 'number',
              prompt: 'How many bones?',
              answer: '100',
              points: 3,
              payload: { margin: { value: 10, unit: 'percent' } },
            },
            {
              type: 'closest_guess',
              prompt: 'Jelly beans?',
              answer: '500',
              points: 3,
            },
          ],
        },
      ],
    });
    await game.openFirstQuestion(await game.connectAdmin());
    return game;
  }

  function storedPoints(
    game: Awaited<ReturnType<typeof night>>,
    questionId: number,
  ) {
    return game.inRequestContext(async () => {
      const answers = await game.answerService.listForQuestion(
        game.gameSessionId,
        questionId,
      );
      return Object.fromEntries(
        answers.map((answer) => [answer.teamName, answer.pointsAwarded]),
      );
    });
  }

  it('grades the buying team against the doubled margin at submit and on a key fix, others against the stored one', async () => {
    const game = await night();
    const [wide, plain] = game.teams;
    const [bones] = game.rounds[0].questionIds;

    const ack = await game.gateway.handleBuyPowerUp(asSocket(wide.socket), {
      powerUp: 'wider_margin',
      questionId: bones,
    });
    expect(ack).toEqual({ success: true });
    for (const team of [wide, plain]) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId: bones,
        teamId: team.teamId,
        value: '115', // outside 10%, inside the doubled 20%
      });
    }
    expect(await storedPoints(game, bones)).toEqual({ Wide: 3, Plain: 0 });

    await game.saveAnswerKeyFix(bones, {
      margin: { value: 5, unit: 'percent' },
    });
    expect(await storedPoints(game, bones)).toEqual({ Wide: 0, Plain: 0 });

    await game.saveAnswerKeyFix(bones, {
      margin: { value: 8, unit: 'percent' },
    });
    expect(await storedPoints(game, bones)).toEqual({ Wide: 3, Plain: 0 });
  });

  it('re-grades an answer already given and tells the buying team, without a resubmit', async () => {
    const game = await night();
    const [wide, plain] = game.teams;
    const [bones] = game.rounds[0].questionIds;
    for (const team of [wide, plain]) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId: bones,
        teamId: team.teamId,
        value: '115', // outside 10%, inside the doubled 20%
      });
    }
    expect(await storedPoints(game, bones)).toEqual({ Wide: 0, Plain: 0 });
    game.clearEmits();

    await game.gateway.handleBuyPowerUp(asSocket(wide.socket), {
      powerUp: 'wider_margin',
      questionId: bones,
    });

    expect(await storedPoints(game, bones)).toEqual({ Wide: 3, Plain: 0 });
    const synced = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(wide.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      )
      .map((emit) => (emit.payload as { answers: TeamAnswerView[] }).answers);
    expect(synced[0]).toEqual([
      expect.objectContaining({ questionId: bones, pointsAwarded: 3 }),
    ]);
  });

  it('is refused on a closest guess', async () => {
    const game = await night();
    const [wide] = game.teams;
    const [, guess] = game.rounds[0].questionIds;
    await game.act('ADVANCE');

    const ack = await game.gateway.handleBuyPowerUp(asSocket(wide.socket), {
      powerUp: 'wider_margin',
      questionId: guess,
    });

    expect(ack).toMatchObject({ success: false });
  });
});
