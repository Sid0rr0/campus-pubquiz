import { WsException } from '@nestjs/websockets';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — leaving the break with the Early answer reveal on', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let questionId: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      settings: { earlyAnswerReveal: true },
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
          ],
        },
        {
          title: 'Round 2',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Name a fruit', answer: 'x' },
          ],
        },
      ],
    });
    [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'Jupitor',
    });
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> answers_intro
    await game.act('ADVANCE'); // -> answers
    const breakIntro = await game.act('ADVANCE'); // -> break_intro
    expect(breakIntro.progress.status).toBe('break_intro');
  });

  it('refuses the exit while an answer is ungraded, and saves nothing', async () => {
    await expect(game.act('ADVANCE')).rejects.toThrow(WsException);

    expect((await game.snapshot()).progress.status).toBe('break_intro');
  });

  it('saves the next round intro with the leaderboard visible once graded, so a restart restores it', async () => {
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    await game.gateway.handleGradeAnswer(asSocket(await game.connectAdmin()), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });

    const roundIntro = await game.act('ADVANCE');

    expect(roundIntro.progress).toMatchObject({
      status: 'round_intro',
      roundIndex: 1,
      isLeaderboardVisible: true,
    });
    const restarted = await game.restart();
    expect((await restarted.snapshot()).progress).toMatchObject({
      status: 'round_intro',
      isLeaderboardVisible: true,
    });
  });
});
