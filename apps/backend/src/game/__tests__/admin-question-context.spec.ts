import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const UNKNOWN_QUESTION_ID = 999_999;

describe('GameStateService — getAdminQuestionContext', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
  });

  it('returns the correct answer and round position for a question', () => {
    const landmarkId = game.rounds[1].questionIds[0];

    expect(
      game.gameState.getAdminQuestionContext(game.joinCode, landmarkId),
    ).toEqual({
      type: 'free_text',
      prompt: 'Which landmark is shown?',
      mediaUrl: 'https://example.com/landmark.jpg',
      points: 3,
      correctAnswer: 'Eiffel Tower',
      roundTitle: 'Landmarks & Flags',
      roundNumber: 2,
      questionNumberInRound: 1,
      totalQuestionsInRound: 2,
    });
  });

  it('numbers a question within its own round, not the whole quiz', () => {
    const planetId = game.rounds[0].questionIds[1];

    expect(
      game.gameState.getAdminQuestionContext(game.joinCode, planetId),
    ).toMatchObject({
      roundNumber: 1,
      questionNumberInRound: 2,
      totalQuestionsInRound: 2,
    });
  });

  it('returns null for an unknown question id', () => {
    expect(
      game.gameState.getAdminQuestionContext(
        game.joinCode,
        UNKNOWN_QUESTION_ID,
      ),
    ).toBeNull();
  });
});
