import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
  type MockGameProgressRepository,
  type MockSeedService,
} from './test-utils';

describe('GameStateService — persistence and quiz selection', () => {
  let service: GameStateService;
  let progressRepository: MockGameProgressRepository;
  let seedService: MockSeedService;

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    seedService = createFakeGameStateSeedService();
    service = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(progressRepository),
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('persists progress via the repository after applying an action', async () => {
    await service.applyAction('START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith(101, {
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('rehydrates progress from the repository on init instead of defaulting to lobby', async () => {
    const rehydratingRepository = createFakeGameProgressRepository({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    const rehydratedService = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(rehydratingRepository),
      createFakeOrm(),
    );
    await rehydratedService.onModuleInit();

    const snapshot = rehydratedService.getSnapshot();
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(22);
  });

  it('exposes the active quiz id', () => {
    expect(service.getActiveQuizId()).toBe(1);
  });

  it('rejects selecting a quiz while a quiz is in progress', async () => {
    await service.applyAction('START_QUIZ');

    await expect(service.selectQuiz(2)).rejects.toThrow(/lobby/i);
    expect(seedService.createSession).not.toHaveBeenCalled();
  });

  it('selects a quiz after the game has ended and resets back to the lobby', async () => {
    await service.applyAction('END_QUIZ');

    const snapshot = await service.selectQuiz(2);

    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(seedService.createSession).toHaveBeenCalledWith(2);
    expect(seedService.loadGame).toHaveBeenCalledWith(2, 102, 'GHIJKL');
  });

  it('selects a quiz in the lobby: creates a new session, reloads rounds, resets state', async () => {
    service.setLeaderboard([
      { teamId: 31, teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    const snapshot = await service.selectQuiz(2);

    expect(seedService.createSession).toHaveBeenCalledWith(2);
    expect(seedService.loadGame).toHaveBeenCalledWith(2, 102, 'GHIJKL');
    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.leaderboard).toEqual([]);
    expect(service.getActiveQuizId()).toBe(2);
    expect(service.getGameSessionId()).toBe(102);
  });

  it('persists later actions under the newly created session id', async () => {
    await service.selectQuiz(2);

    await service.applyAction('START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith(102, {
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('drives the game with the newly selected quiz rounds after selection', async () => {
    await service.selectQuiz(2);

    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    const started = await service.applyAction('ADVANCE');
    expect(started.currentQuestion?.id).toBe(25);
  });

  it('exposes the new session join code in the snapshot after selecting a quiz', async () => {
    const snapshot = await service.selectQuiz(2);

    expect(snapshot.joinCode).toBe('GHIJKL');
  });
});
