import {
  IllegalGameTransitionError,
  type GameProgress,
} from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { GameProgressRepository } from '@/game/game-progress.repository';
import type { QuizService } from '@/quiz/quiz.service';
import { GameStateService } from '@/game/game-state.service';

const FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 'quiz-1',
  gameSessionId: 'session-1',
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 'round-1',
      breakAfter: false,
      questions: [
        {
          id: 'r1q1',
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          points: 2,
        },
        {
          id: 'r1q2',
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          points: 2,
        },
      ],
    },
    {
      id: 'round-2',
      breakAfter: true,
      questions: [
        {
          id: 'r2q1',
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
        },
        {
          id: 'r2q2',
          type: 'free_text',
          prompt: 'Name this flag.',
          points: 3,
        },
      ],
    },
  ],
};

const IMPORTED_QUIZ_GAME: SeededGame = {
  quizId: 'quiz-2',
  gameSessionId: 'session-1',
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 'round-imported',
      breakAfter: true,
      questions: [
        {
          id: 'iq1',
          type: 'free_text',
          prompt: 'Imported question',
          points: 1,
        },
      ],
    },
  ],
};

function createFakeSeedService() {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
    loadGame: jest.fn().mockResolvedValue(IMPORTED_QUIZ_GAME),
  };
}

type MockSeedService = ReturnType<typeof createFakeSeedService>;

function asSeedService(mock: MockSeedService): SeedService {
  return mock as unknown as SeedService;
}

function createFakeQuizService() {
  return {
    list: jest.fn().mockResolvedValue([
      { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
      { id: 'quiz-2', title: 'Imported Quiz' },
    ]),
    assignToSession: jest.fn().mockResolvedValue(undefined),
  };
}

type MockQuizService = ReturnType<typeof createFakeQuizService>;

function asQuizService(mock: MockQuizService): QuizService {
  return mock as unknown as QuizService;
}

function createFakeGameProgressRepository(initial: GameProgress | null = null) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(initial),
  };
}

type MockGameProgressRepository = ReturnType<
  typeof createFakeGameProgressRepository
>;

function asGameProgressRepository(
  mock: MockGameProgressRepository,
): GameProgressRepository {
  return mock as unknown as GameProgressRepository;
}

describe('GameStateService', () => {
  let service: GameStateService;
  let progressRepository: MockGameProgressRepository;
  let seedService: MockSeedService;
  let quizService: MockQuizService;

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    seedService = createFakeSeedService();
    quizService = createFakeQuizService();
    service = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(progressRepository),
      asQuizService(quizService),
    );
    await service.onModuleInit();
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      asSeedService(createFakeSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      asQuizService(createFakeQuizService()),
    );
    await expect(uninitialized.applyAction('START_QUIZ')).rejects.toThrow(
      /before initialization/i,
    );
  });

  it('exposes the seeded game session id', () => {
    expect(service.getGameSessionId()).toBe('session-1');
  });

  it('starts in the lobby with no current question', () => {
    const snapshot = service.getSnapshot();
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('opens the first question of the first round on START_QUIZ', async () => {
    const snapshot = await service.applyAction('START_QUIZ');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r1q1');
  });

  it('keeps the current question visible while locked', async () => {
    await service.applyAction('START_QUIZ');
    const snapshot = await service.applyAction('LOCK_ANSWERS');
    expect(snapshot.progress.status).toBe('locked');
    expect(snapshot.currentQuestion?.id).toBe('r1q1');
  });

  it('advances to the next question within round 1', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('LOCK_ANSWERS');
    const snapshot = await service.applyAction('ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r1q2');
  });

  it('moves into round 2 after round 1 finishes (no break configured)', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('LOCK_ANSWERS');
    const snapshot = await service.applyAction('ADVANCE'); // round 1 done, no break -> round 2 q0
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r2q1');
  });

  it('enters a break once round 2 (breakAfter: true) finishes, hiding the question', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('LOCK_ANSWERS');
    const snapshot = await service.applyAction('ADVANCE'); // round 2 done, breakAfter -> break
    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE');
    await service.applyAction('LOCK_ANSWERS');
    await service.applyAction('ADVANCE'); // -> break

    const revealSnapshot = await service.applyAction('FINISH_GRADING');
    expect(revealSnapshot.progress.status).toBe('reveal');

    const endedSnapshot = await service.applyAction('ADVANCE');
    expect(endedSnapshot.progress.status).toBe('ended');
  });

  it('toggles the leaderboard without disturbing the underlying status', async () => {
    await service.applyAction('START_QUIZ');
    const withLeaderboard = await service.applyAction('TOGGLE_LEADERBOARD');
    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe('r1q1');
  });

  it('propagates an illegal-transition error for out-of-order actions', async () => {
    await expect(service.applyAction('LOCK_ANSWERS')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('starts with an empty leaderboard', () => {
    expect(service.getSnapshot().leaderboard).toEqual([]);
  });

  it('reflects a leaderboard set via setLeaderboard in the snapshot', () => {
    service.setLeaderboard([
      { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    expect(service.getSnapshot().leaderboard).toEqual([
      { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
    ]);
  });

  it('persists progress via the repository after applying an action', async () => {
    await service.applyAction('START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith('session-1', {
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('rehydrates progress from the repository on init instead of defaulting to lobby', async () => {
    const rehydratingRepository = createFakeGameProgressRepository({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
    });
    const rehydratedService = new GameStateService(
      asSeedService(createFakeSeedService()),
      asGameProgressRepository(rehydratingRepository),
      asQuizService(createFakeQuizService()),
    );
    await rehydratedService.onModuleInit();

    const snapshot = rehydratedService.getSnapshot();
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r1q2');
  });

  it('exposes the active quiz id', () => {
    expect(service.getActiveQuizId()).toBe('quiz-1');
  });

  it('rejects selecting a quiz while a quiz is in progress', async () => {
    await service.applyAction('START_QUIZ');

    await expect(service.selectQuiz('quiz-2')).rejects.toThrow(/lobby/i);
    expect(quizService.assignToSession).not.toHaveBeenCalled();
  });

  it('selects a quiz after the game has ended and resets back to the lobby', async () => {
    await service.applyAction('END_QUIZ');

    const snapshot = await service.selectQuiz('quiz-2');

    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(quizService.assignToSession).toHaveBeenCalledWith(
      'session-1',
      'quiz-2',
    );
    expect(seedService.loadGame).toHaveBeenCalledWith(
      'quiz-2',
      'session-1',
      'ABCDEF',
    );
  });

  it('selects a quiz in the lobby: assigns it, reloads rounds, resets state, persists', async () => {
    service.setLeaderboard([
      { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    const snapshot = await service.selectQuiz('quiz-2');

    expect(quizService.assignToSession).toHaveBeenCalledWith(
      'session-1',
      'quiz-2',
    );
    expect(seedService.loadGame).toHaveBeenCalledWith(
      'quiz-2',
      'session-1',
      'ABCDEF',
    );
    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.leaderboard).toEqual([]);
    expect(service.getActiveQuizId()).toBe('quiz-2');
    expect(progressRepository.save).toHaveBeenCalledWith('session-1', {
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
  });

  it('drives the game with the newly selected quiz rounds after selection', async () => {
    await service.selectQuiz('quiz-2');

    const started = await service.applyAction('START_QUIZ');
    expect(started.currentQuestion?.id).toBe('iq1');
  });
});
