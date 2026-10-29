import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { QuizDraftInvalidError } from '@/quiz/quiz.service';

const question = (prompt: string, answer: string) => ({
  type: 'free_text' as const,
  prompt,
  answer,
  points: 2,
});

const round = (title: string, prompt: string, answer: string) => ({
  title,
  breakAfter: true,
  questions: [question(prompt, answer)],
});

describe('Live edit — saving a question id that belongs to another quiz', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [round('Round A', 'Q1', 'Jupiter')],
      teamNames: [],
    });
  });

  it("refuses the save and leaves the other quiz's question where it was", async () => {
    const other = await game.inRequestContext(() =>
      game.quizService.create('Other quiz', [
        round('Other round', 'Elsewhere', 'Nowhere'),
      ]),
    );
    const otherDraft = await game.inRequestContext(() =>
      game.quizService.findDraftById(other.quizId),
    );
    const foreignId = otherDraft!.rounds[0].questions[0].questionId;

    await expect(
      game.saveQuizEdit((rounds) =>
        rounds.map((r) => ({
          ...r,
          questions: [
            ...r.questions,
            { ...question('Smuggled', 'Yes'), questionId: foreignId },
          ],
        })),
      ),
    ).rejects.toBeInstanceOf(QuizDraftInvalidError);

    const after = await game.inRequestContext(() =>
      game.quizService.findDraftById(other.quizId),
    );
    expect(after!.rounds[0].questions.map((q) => q.prompt)).toEqual([
      'Elsewhere',
    ]);
    const own = await game.inRequestContext(() =>
      game.quizService.findDraftById(game.quizId),
    );
    expect(own!.rounds[0].questions.map((q) => q.prompt)).toEqual(['Q1']);
  });

  it('still saves a draft that only reorders and edits its own questions', async () => {
    await expect(
      game.saveQuizEdit((rounds) =>
        rounds.map((r) => ({
          ...r,
          questions: r.questions.map((q) => ({ ...q, answer: 'Saturn' })),
        })),
      ),
    ).resolves.toMatchObject({ questionCount: 1 });
  });
});
