import { IllegalGameTransitionError, type GameProgress } from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { GameProgressRepository } from '@/game/game-progress.repository';
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

function createFakeSeedService(): SeedService {
  return {
    seed: jest.fn().mockResolvedValue(FIXTURE_SEEDED_GAME),
  } as unknown as SeedService;
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

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    service = new GameStateService(
      createFakeSeedService(),
      asGameProgressRepository(progressRepository),
    );
    await service.onModuleInit();
  });

  it('throws if used before onModuleInit resolves the seeded game', () => {
    const uninitialized = new GameStateService(
      createFakeSeedService(),
      asGameProgressRepository(createFakeGameProgressRepository()),
    );
    expect(() => uninitialized.applyAction('START_QUIZ')).toThrow(
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

  it('propagates an illegal-transition error for out-of-order actions', () => {
    expect(() => service.applyAction('LOCK_ANSWERS')).toThrow(
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
      createFakeSeedService(),
      asGameProgressRepository(rehydratingRepository),
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
});
