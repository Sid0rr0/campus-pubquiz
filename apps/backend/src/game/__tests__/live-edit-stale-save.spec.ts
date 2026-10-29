import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { QuizStaleSaveError } from '@/quiz/quiz.service';

const ROUNDS = [
  {
    title: 'Round A',
    breakAfter: true,
    questions: [
      {
        type: 'free_text' as const,
        prompt: 'Q1',
        answer: 'Jupiter',
        points: 2,
      },
    ],
  },
];

describe('Live edit — saving from an editor tab that has gone stale', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: ROUNDS, teamNames: [] });
  });

  /** Loads the quiz the way an editor tab does, then saves it with `answer` for Q1, claiming the version it loaded. */
  const saveAnswerFromTab = (
    tab: { loadedUpdatedAt: string },
    answer: string,
  ) =>
    game.inRequestContext(async () => {
      const draft = await game.quizService.findDraftById(game.quizId);
      if (!draft) throw new Error('quiz is gone');
      return game.liveEdit.save(game.quizId, {
        title: draft.title,
        loadedUpdatedAt: tab.loadedUpdatedAt,
        rounds: draft.rounds.map((round) => ({
          ...round,
          questions: round.questions.map((question) => ({
            ...question,
            answer,
          })),
        })),
      });
    });

  const loadVersion = async () => {
    const draft = await game.inRequestContext(() =>
      game.quizService.findDraftById(game.quizId),
    );
    return draft!.updatedAt;
  };

  it('refuses a save made from a copy older than the stored quiz, and keeps the newer save', async () => {
    const tabA = { loadedUpdatedAt: await loadVersion() };
    const tabB = { loadedUpdatedAt: await loadVersion() };

    const saved = await saveAnswerFromTab(tabA, 'Saturn');
    await expect(saveAnswerFromTab(tabB, 'Mars')).rejects.toBeInstanceOf(
      QuizStaleSaveError,
    );

    const draft = await game.inRequestContext(() =>
      game.quizService.findDraftById(game.quizId),
    );
    expect(draft!.rounds[0].questions[0].answer).toBe('Saturn');
    expect(draft!.updatedAt).toBe(saved.updatedAt);
  });

  it('accepts the next save from the version the last save returned', async () => {
    const tab = { loadedUpdatedAt: await loadVersion() };
    const first = await saveAnswerFromTab(tab, 'Saturn');

    await expect(
      saveAnswerFromTab({ loadedUpdatedAt: first.updatedAt }, 'Mars'),
    ).resolves.toMatchObject({ questionCount: 1 });
  });

  it('still saves when the request names no version (a re-import, an API client)', async () => {
    await expect(game.saveQuizEdit()).resolves.toMatchObject({
      questionCount: 1,
    });
  });
});
