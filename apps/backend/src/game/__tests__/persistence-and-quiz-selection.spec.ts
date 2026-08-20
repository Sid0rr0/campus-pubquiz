import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockGameProgressRepository,
  type MockSeedService,
} from './test-utils';

describe('GameStateService — persistence and quiz selection', () => {
  let service: GameStateService;
  let joinCode: string;
  let progressRepository: MockGameProgressRepository;
  let seedService: MockSeedService;

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    seedService = createFakeGameStateSeedService();
    service = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(progressRepository),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('persists progress via the repository after applying an action', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith(101, {
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
  });

  it('rehydrates progress from the repository on init instead of defaulting to lobby', async () => {
    const rehydratingRepository = createFakeGameProgressRepository({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
    const rehydratedService = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(rehydratingRepository),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await rehydratedService.onModuleInit();
    const rehydratedJoinCode = 'ABCDEF';

    const snapshot = rehydratedService.getSnapshot(rehydratedJoinCode);
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(22);
  });

  it('exposes the active quiz id', () => {
    expect(service.getActiveQuizId(joinCode)).toBe(1);
  });

  it('creates a new concurrent session even while the default session has a quiz in progress', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');

    const snapshot = await service.createSession(2);

    expect(snapshot.joinCode).toBe('GHIJKL');
    expect(seedService.createSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
    );
    // The original session keeps running untouched by the new one.
    expect(service.getSnapshot(joinCode).progress.status).toBe('rules');
  });

  it('creates a session after the default game has ended, starting it in the lobby', async () => {
    await service.applyAction(joinCode, 'END_QUIZ');

    const snapshot = await service.createSession(2);

    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(seedService.createSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
    );
    expect(seedService.loadGame).toHaveBeenCalledWith(2, 102, 'GHIJKL');
  });

  it('creates a session from the lobby: allocates a new session, loads its rounds, starts fresh', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 31,
        teamName: 'The Quizzards',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);

    const snapshot = await service.createSession(2);

    expect(seedService.createSession).toHaveBeenCalledWith(
      2,
      DEFAULT_SESSION_SETTINGS,
    );
    expect(seedService.loadGame).toHaveBeenCalledWith(2, 102, 'GHIJKL');
    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(snapshot.leaderboard).toEqual([]);
    expect(service.getActiveQuizId(snapshot.joinCode)).toBe(2);
    expect(service.getGameSessionId(snapshot.joinCode)).toBe(102);
  });

  it('persists later actions under the newly created session id', async () => {
    const created = await service.createSession(2);

    await service.applyAction(created.joinCode, 'START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith(102, {
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
  });

  it('drives the game with the newly created session rounds', async () => {
    const created = await service.createSession(2);

    await service.applyAction(created.joinCode, 'START_QUIZ');
    await service.applyAction(created.joinCode, 'ADVANCE'); // -> round_intro(0)
    const started = await service.applyAction(created.joinCode, 'ADVANCE');
    expect(started.currentQuestion?.id).toBe(25);
  });

  it('exposes the new session join code in the snapshot after creating a session', async () => {
    const snapshot = await service.createSession(2);

    expect(snapshot.joinCode).toBe('GHIJKL');
  });
});
