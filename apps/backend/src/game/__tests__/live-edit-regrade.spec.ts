import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/state/game-state.service';
import {
  asAnswerService,
  asGameProgressRepository,
  asSeedService,
  asShowdownService,
  createFakeAnswerService,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeKahootSeedService,
  createFakeOrm,
  createFakeShowdownService,
  createTestGateway,
  GAME_STATE_FIXTURE_SEEDED_GAME,
} from './test-utils';

type FakeAnswerService = ReturnType<typeof createFakeAnswerService>;
type FakeSeedService = ReturnType<typeof createFakeGameStateSeedService>;

const HUMAN_GRADED_GAME: SeededGame = {
  ...GAME_STATE_FIXTURE_SEEDED_GAME,
  rounds: [
    {
      id: 11,
      title: 'General Knowledge',
      breakAfter: false,
      questions: [
        {
          id: 22,
          type: 'audio',
          prompt: 'Name that tune',
          points: 2,
          answer: 'Reference answer',
        },
      ],
      questionNotesById: { 22: null },
    },
  ],
};

const CLOSEST_GUESS_GAME: SeededGame = {
  ...GAME_STATE_FIXTURE_SEEDED_GAME,
  rounds: [
    {
      id: 15,
      title: 'Estimation',
      breakAfter: true,
      questions: [
        {
          id: 41,
          type: 'closest_guess',
          prompt: 'How many jelly beans?',
          points: 3,
          answer: '500',
        },
      ],
    },
  ],
};

async function createService(
  seedService: FakeSeedService,
  answerService: FakeAnswerService,
): Promise<GameStateService> {
  const service = new GameStateService(
    asSeedService(seedService),
    asGameProgressRepository(createFakeGameProgressRepository()),
    createFakeOrm(),
    asAnswerService(answerService),
    asShowdownService(createFakeShowdownService()),
  );
  await service.onModuleInit();
  return service;
}

describe('GameStateService.regradeQuestions', () => {
  it('re-scores an auto-graded question against the reloaded answer key and refreshes the leaderboard', async () => {
    const answerService = createFakeAnswerService();
    const service = await createService(
      createFakeGameStateSeedService(),
      answerService,
    );

    await service.regradeQuestions('ABCDEF', [21]);

    expect(answerService.regradeAutoGraded).toHaveBeenCalledWith(
      101,
      21,
      'multiple_choice',
      'Paris',
      2,
      {},
    );
    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
  });

  it('leaves a human-graded question alone, without touching the leaderboard', async () => {
    const answerService = createFakeAnswerService();
    const seedService = createFakeGameStateSeedService();
    seedService.seed.mockResolvedValue(HUMAN_GRADED_GAME);
    const service = await createService(seedService, answerService);

    await service.regradeQuestions('ABCDEF', [22]);

    expect(answerService.regradeAutoGraded).not.toHaveBeenCalled();
    expect(answerService.computeLeaderboard).not.toHaveBeenCalled();
  });

  it('re-scores a free_text question against the reloaded answer key, same as the other auto-graded types', async () => {
    const answerService = createFakeAnswerService();
    const service = await createService(
      createFakeGameStateSeedService(),
      answerService,
    );

    await service.regradeQuestions('ABCDEF', [22]);

    expect(answerService.regradeAutoGraded).toHaveBeenCalledWith(
      101,
      22,
      'free_text',
      'Jupiter',
      2,
      {},
    );
    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
  });

  it('re-applies the speed multipliers recorded when a kahoot question was scored', async () => {
    const answerService = createFakeAnswerService();
    answerService.applyKahootSpeedScoring.mockResolvedValueOnce({
      501: 0.75,
    });
    const service = await createService(
      createFakeKahootSeedService(),
      answerService,
    );
    await service.applyAction('KAHOOT', 'START_QUIZ');
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> round_intro
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> question_open q0
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> locking q0
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> reveal q0 (speed-scored)

    await service.regradeQuestions('KAHOOT', [31]);

    expect(answerService.regradeAutoGraded).toHaveBeenCalledWith(
      103,
      31,
      'multiple_choice',
      'Paris',
      10,
      { 501: 0.75 },
    );
  });

  it('leaves a kahoot question that has not been speed-scored yet to the scoring at lock', async () => {
    const answerService = createFakeAnswerService();
    const service = await createService(
      createFakeKahootSeedService(),
      answerService,
    );
    await service.applyAction('KAHOOT', 'START_QUIZ');
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> round_intro
    await service.applyAction('KAHOOT', 'ADVANCE'); // -> question_open q0

    await service.regradeQuestions('KAHOOT', [31]);

    expect(answerService.regradeAutoGraded).not.toHaveBeenCalled();
    expect(answerService.computeLeaderboard).not.toHaveBeenCalled();
  });

  it('skips a closest_guess question that has not been graded yet', async () => {
    const answerService = createFakeAnswerService();
    const seedService = createFakeGameStateSeedService();
    seedService.seed.mockResolvedValue(CLOSEST_GUESS_GAME);
    const service = await createService(seedService, answerService);

    await service.regradeQuestions('ABCDEF', [41]);

    expect(answerService.gradeClosestGuess).not.toHaveBeenCalled();
    expect(answerService.computeLeaderboard).not.toHaveBeenCalled();
  });

  it('re-runs closest_guess batch grading with the corrected target once it has been graded', async () => {
    const answerService = createFakeAnswerService();
    const seedService = createFakeGameStateSeedService();
    seedService.seed.mockResolvedValue(CLOSEST_GUESS_GAME);
    const service = await createService(seedService, answerService);
    await service.applyAction('ABCDEF', 'START_QUIZ');
    for (
      let step = 0;
      step < 6 && answerService.gradeClosestGuess.mock.calls.length === 0;
      step += 1
    ) {
      await service.applyAction('ABCDEF', 'ADVANCE');
    }
    expect(answerService.gradeClosestGuess).toHaveBeenCalledTimes(1);
    seedService.loadGame.mockResolvedValue({
      ...CLOSEST_GUESS_GAME,
      rounds: [
        {
          ...CLOSEST_GUESS_GAME.rounds[0],
          questions: [
            { ...CLOSEST_GUESS_GAME.rounds[0].questions[0], answer: '650' },
          ],
        },
      ],
    });
    await service.reloadActiveQuiz('ABCDEF');

    await service.regradeQuestions('ABCDEF', [41]);

    expect(answerService.gradeClosestGuess).toHaveBeenLastCalledWith(
      101,
      41,
      '650',
      3,
    );
  });
});

describe('GameGateway.notifyQuizEdited', () => {
  it('reloads the quiz, regrades the corrected questions, then broadcasts', async () => {
    const seedService = createFakeGameStateSeedService();
    seedService.loadGame.mockResolvedValue(GAME_STATE_FIXTURE_SEEDED_GAME);
    const { gateway, server, answerService } =
      await createTestGateway(seedService);

    await gateway.notifyQuizEdited('ABCDEF', [21]);

    expect(answerService.regradeAutoGraded).toHaveBeenCalledWith(
      101,
      21,
      'multiple_choice',
      'Paris',
      2,
      {},
    );
    const [loadOrder] = seedService.loadGame.mock.invocationCallOrder;
    const [regradeOrder] =
      answerService.regradeAutoGraded.mock.invocationCallOrder;
    expect(loadOrder).toBeLessThan(regradeOrder);
    expect(server.to).toHaveBeenCalled();
  });

  it('skips regrading when no graded field changed', async () => {
    const seedService = createFakeGameStateSeedService();
    seedService.loadGame.mockResolvedValue(GAME_STATE_FIXTURE_SEEDED_GAME);
    const { gateway, server, answerService } =
      await createTestGateway(seedService);

    await gateway.notifyQuizEdited('ABCDEF', []);

    expect(seedService.loadGame).toHaveBeenCalled();
    expect(answerService.regradeAutoGraded).not.toHaveBeenCalled();
    expect(answerService.computeLeaderboard).not.toHaveBeenCalled();
    expect(server.to).toHaveBeenCalled();
  });
});
