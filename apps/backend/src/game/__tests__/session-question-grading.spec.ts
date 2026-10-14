import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — submit and hand grading use the session question', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let questionId: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Name a band', answer: 'Queen' },
          ],
        },
      ],
    });
    questionId = game.rounds[0].questionIds[0];
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
  });

  async function submit(value: string) {
    const [{ socket, teamId }] = game.teams;
    return game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value,
    });
  }

  async function storedAnswers() {
    return game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
  }

  it('grades a submit against the key the session holds, not the stored question row', async () => {
    await game.inRequestContext(() =>
      game.orm.em
        .fork()
        .getConnection()
        .execute("UPDATE questions SET answer = 'Abba'"),
    );

    await submit('Queen');

    const [answer] = await storedAnswers();
    expect(answer).toMatchObject({ verdict: 'correct', pointsAwarded: 1 });
  });

  it('refuses to hand grade an answer to a question the session does not hold', async () => {
    await submit('Banana');
    const [{ answerId }] = await storedAnswers();
    let foreignId = 0;
    await game.inRequestContext(async () => {
      const em = game.orm.em.fork();
      const quiz = em.create(Quiz, { title: 'Another quiz' });
      const round = em.create(Round, {
        quiz,
        title: 'Elsewhere',
        orderIndex: 0,
      });
      const foreign = em.create(Question, {
        round,
        orderIndex: 0,
        type: 'free_text',
        prompt: 'Not in this session',
        answer: 'Nope',
        points: 1,
      });
      await em.flush();
      foreignId = foreign.id;
      await em
        .getConnection()
        .execute(`UPDATE answers SET question_id = ${foreign.id}`);
    });
    const admin = await game.connectAdmin();

    const result = await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 1,
    });

    expect(result).toMatchObject({ success: false });
    const [stored] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, foreignId),
    );
    expect(stored).toMatchObject({ pointsAwarded: 0, gradedAt: null });
  });
});
