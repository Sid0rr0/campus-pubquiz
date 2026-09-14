import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeKahootSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  KAHOOT_SEEDED_GAME,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

const KAHOOT_TIMER_SECONDS = 30;

function createFakeTimedKahootSeedService() {
  const seedService = createFakeKahootSeedService();
  const timedSeededGame = {
    ...KAHOOT_SEEDED_GAME,
    settings: {
      ...KAHOOT_SEEDED_GAME.settings,
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    },
  };
  seedService.seed.mockResolvedValue(timedSeededGame);
  seedService.loadGame.mockResolvedValue(timedSeededGame);
  return seedService;
}

describe('GameStateService — kahoot question timer', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has no deadline in the lobby', async () => {
    service = new GameStateService(
      asSeedService(createFakeTimedKahootSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'KAHOOT';

    expect(service.getKahootQuestionEndsAt(joinCode)).toBeNull();
  });

  it('has no deadline on a non-kahoot round question_open', async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro
    const opened = await service.applyAction(joinCode, 'ADVANCE'); // -> question_open

    expect(opened.progress.status).toBe('question_open');
    expect(service.getKahootQuestionEndsAt(joinCode)).toBeNull();
  });

  it('has no deadline when kahootQuestionTimerSeconds is null (default settings)', async () => {
    service = new GameStateService(
      asSeedService(createFakeKahootSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'KAHOOT';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro
    const opened = await service.applyAction(joinCode, 'ADVANCE'); // -> question_open q0

    expect(opened.progress.status).toBe('question_open');
    expect(service.getKahootQuestionEndsAt(joinCode)).toBeNull();
  });

  it('arms the deadline at phaseStartedAt + timerSeconds*1000 once a kahoot question opens', async () => {
    service = new GameStateService(
      asSeedService(createFakeTimedKahootSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'KAHOOT';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro
    const opened = await service.applyAction(joinCode, 'ADVANCE'); // -> question_open q0

    expect(opened.progress.status).toBe('question_open');
    const expected = Date.now() + KAHOOT_TIMER_SECONDS * 1000;
    expect(service.getKahootQuestionEndsAt(joinCode)).toBe(expected);
    expect(opened.kahootQuestionEndsAt).toBe(expected);
  });

  it('clears the deadline on ADVANCE into locking', async () => {
    service = new GameStateService(
      asSeedService(createFakeTimedKahootSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'KAHOOT';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> question_open q0
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // -> locking q0

    expect(locking.progress.status).toBe('locking');
    expect(service.getKahootQuestionEndsAt(joinCode)).toBeNull();
    expect(locking.kahootQuestionEndsAt).toBeNull();
  });

  it('does not re-arm a deadline when PREVIOUS reopens an older, non-frontier kahoot question', async () => {
    service = new GameStateService(
      asSeedService(createFakeTimedKahootSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'KAHOOT';

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> question_open q0 (live)
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking q0
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal q0
    await service.applyAction(joinCode, 'ADVANCE'); // -> question_open q1 (now live)

    await service.applyAction(joinCode, 'PREVIOUS'); // -> reveal q0
    await service.applyAction(joinCode, 'PREVIOUS'); // -> locking q0
    const reopened = await service.applyAction(joinCode, 'PREVIOUS'); // -> question_open q0 (historical)

    expect(reopened.progress.status).toBe('question_open');
    expect(reopened.progress.questionIndex).toBe(0);
    expect(service.getKahootQuestionEndsAt(joinCode)).toBeNull();
    expect(reopened.kahootQuestionEndsAt).toBeNull();
  });

  it('re-arms the deadline against the persisted phaseStartedAt on rehydrate, not a fresh Date.now()', async () => {
    const elapsedMs = 5_000;
    const phaseStartedAt = Date.now() - elapsedMs;
    const rehydratingRepository = createFakeGameProgressRepository(
      {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 0,
        isLeaderboardVisible: false,
        revealIndex: 0,
        furthestOpenIndex: 0,
      },
      {
        livePhaseKey: 'q:0:0:0',
        phaseStartedAt,
        phaseElapsedByKey: {},
      },
    );
    const rehydratedService = new GameStateService(
      asSeedService(createFakeTimedKahootSeedService()),
      asGameProgressRepository(rehydratingRepository),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await rehydratedService.onModuleInit();

    expect(rehydratedService.getKahootQuestionEndsAt('KAHOOT')).toBe(
      phaseStartedAt + KAHOOT_TIMER_SECONDS * 1000,
    );
  });
});
