import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
} from './test-utils';

describe('GameStateService — getAdminQuestionContext', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('returns the correct answer and round position for a question', () => {
    expect(service.getAdminQuestionContext(joinCode, 23)).toEqual({
      type: 'picture',
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
    expect(service.getAdminQuestionContext(joinCode, 22)).toMatchObject({
      roundNumber: 1,
      questionNumberInRound: 2,
      totalQuestionsInRound: 2,
    });
  });

  it('returns null for an unknown question id', () => {
    expect(service.getAdminQuestionContext(joinCode, 999999)).toBeNull();
  });
});
