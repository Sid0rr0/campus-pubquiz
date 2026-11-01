import type { ImportRoundPreview } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';

describe('Editing a quiz whose ended session has stored answers', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Answered', answer: 'A' },
            { type: 'free_text', prompt: 'Never answered', answer: 'B' },
          ],
        },
      ],
      teamNames: ['Saturn Fans'],
    });
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.rounds[0].questionIds[0],
      teamId,
      value: 'A',
    });
    await game.act('END_QUIZ');
  });

  const withoutQuestion =
    (questionIndex: number) => (rounds: ImportRoundPreview[]) =>
      rounds.map((round) => ({
        ...round,
        questions: round.questions.filter((_, i) => i !== questionIndex),
      }));

  it('refuses a save that deletes a question with stored answers, which would delete those answers with it', async () => {
    const error: unknown = await game
      .saveQuizEdit(withoutQuestion(0))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuizLiveEditBlockedError);
    // The editor's toast shows this message, so it carries the reason itself.
    expect((error as Error).message).toMatch(/already answered/);
  });

  it('tells the editor a re-imported sheet replaces every question, when it carries no question ids', async () => {
    const error: unknown = await game
      .saveQuizEdit((rounds) =>
        rounds.map((round) => ({
          ...round,
          questions: round.questions.map((question) => ({
            ...question,
            questionId: undefined,
          })),
        })),
      )
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuizLiveEditBlockedError);
    expect((error as Error).message).toMatch(/re-import/);
  });

  it('still lets a question nobody answered be deleted', async () => {
    await expect(game.saveQuizEdit(withoutQuestion(1))).resolves.toBeDefined();
  });

  it('refuses a save that moves an answered question to another round, which would move its jokers and scores with it', async () => {
    const error: unknown = await game
      .saveQuizEdit((rounds) => [
        {
          ...rounds[0],
          questions: [
            { type: 'free_text', prompt: 'New', answer: 'N', points: 1 },
          ],
        },
        {
          title: 'Round B',
          breakAfter: true,
          questions: rounds[0].questions,
        },
      ])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuizLiveEditBlockedError);
    expect((error as Error).message).toMatch(/another round/);
  });

  it('refuses a save that swaps the order of rounds when one holds an answered question', async () => {
    const error: unknown = await game
      .saveQuizEdit((rounds) => [
        {
          title: 'Round B',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'New', answer: 'N', points: 1 },
          ],
        },
        rounds[0],
      ])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(QuizLiveEditBlockedError);
  });

  it('still lets a round be added after the played ones', async () => {
    await expect(
      game.saveQuizEdit((rounds) => [
        ...rounds,
        {
          title: 'Round B',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'New', answer: 'N', points: 1 },
          ],
        },
      ]),
    ).resolves.toBeDefined();
  });

  it('still lets an answered question be reworded', async () => {
    await expect(
      game.saveQuizEdit((rounds) =>
        rounds.map((round) => ({
          ...round,
          questions: round.questions.map((question, i) =>
            i === 0 ? { ...question, prompt: 'Answered, reworded' } : question,
          ),
        })),
      ),
    ).resolves.toBeDefined();
  });
});
