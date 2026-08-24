import { GameStateService } from '@/game/state/game-state.service';
import { UngradedAnswersError } from '@/game/state/errors/ungraded-answers.error';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockAnswerService,
} from '@/game/__tests__/test-utils';

describe('GameStateService — grading gate before reveal', () => {
  let service: GameStateService;
  let answerService: MockAnswerService;
  let joinCode: string;

  beforeEach(async () => {
    answerService = createFakeAnswerService();
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(answerService),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
  });

  it('rejects ADVANCE out of break_intro while a block question still has an ungraded answer', async () => {
    answerService.listUngradedQuestionIds.mockResolvedValueOnce([24]);
    const breakIntro = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    expect(breakIntro.progress.status).toBe('break_intro');

    answerService.listUngradedQuestionIds.mockResolvedValueOnce([24]);
    await expect(service.applyAction(joinCode, 'ADVANCE')).rejects.toThrow(
      UngradedAnswersError,
    );

    // The rejected transition must not have been persisted.
    expect(service.getSnapshot(joinCode).progress.status).toBe('break_intro');
  });

  it('reports the ungraded question ids on the snapshot while reviewing the break screen', async () => {
    answerService.listUngradedQuestionIds.mockResolvedValueOnce([24]);
    const breakIntro = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    expect(breakIntro.ungradedQuestionIds).toEqual([24]);
  });

  it('allows ADVANCE into reveal once nothing is left ungraded', async () => {
    const breakIntro = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro (default mock: nothing ungraded)
    expect(breakIntro.progress.status).toBe('break_intro');
    expect(breakIntro.ungradedQuestionIds).toEqual([]);

    const revealIntro = await service.applyAction(joinCode, 'ADVANCE');
    expect(revealIntro.progress.status).toBe('reveal_intro');
  });

  it('setQuestionGradedStatus incrementally patches the ungraded-question cache', async () => {
    answerService.listUngradedQuestionIds.mockResolvedValueOnce([]);
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    expect(service.getSnapshot(joinCode).ungradedQuestionIds).toEqual([]);

    service.setQuestionGradedStatus(joinCode, 24, true);
    expect(service.getSnapshot(joinCode).ungradedQuestionIds).toEqual([24]);

    service.setQuestionGradedStatus(joinCode, 24, false);
    expect(service.getSnapshot(joinCode).ungradedQuestionIds).toEqual([]);
  });
});
