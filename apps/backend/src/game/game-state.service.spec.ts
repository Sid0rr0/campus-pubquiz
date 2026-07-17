import {
  IllegalGameTransitionError,
  type GameProgress,
} from '@campus-pubquiz/types';
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

const IMPORTED_QUIZ_GAME: SeededGame = {
  quizId: 'quiz-2',
  gameSessionId: 'session-2',
  joinCode: 'GHIJKL',
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
    createSession: jest
      .fn()
      .mockResolvedValue({ gameSessionId: 'session-2', joinCode: 'GHIJKL' }),
  };
}

type MockSeedService = ReturnType<typeof createFakeSeedService>;

function asSeedService(mock: MockSeedService): SeedService {
  return mock as unknown as SeedService;
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

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    seedService = createFakeSeedService();
    service = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(progressRepository),
    );
    await service.onModuleInit();
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      asSeedService(createFakeSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
    );
    await expect(uninitialized.applyAction('START_QUIZ')).rejects.toThrow(
      /before initialization/i,
    );
  });

  it('exposes the seeded game session id', () => {
    expect(service.getGameSessionId()).toBe('session-1');
  });

  it('includes the session join code in the snapshot', () => {
    expect(service.getSnapshot().joinCode).toBe('ABCDEF');
  });

  it('starts with no connected teams in the snapshot', () => {
    expect(service.getSnapshot().teams).toEqual([]);
  });

  it('reflects teams set via setTeams in the snapshot', () => {
    service.setTeams([{ teamId: 'team-1', teamName: 'The Quizzards' }]);

    expect(service.getSnapshot().teams).toEqual([
      { teamId: 'team-1', teamName: 'The Quizzards' },
    ]);
  });

  it('clears the connected teams when a new quiz session is selected', async () => {
    service.setTeams([{ teamId: 'team-1', teamName: 'The Quizzards' }]);

    const snapshot = await service.selectQuiz('quiz-2');

    expect(snapshot.teams).toEqual([]);
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

  it('advances to the next question within round 1', async () => {
    await service.applyAction('START_QUIZ');
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
    await service.applyAction('ADVANCE'); // -> r1q2
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
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    const snapshot = await service.applyAction('ADVANCE'); // round 2 done, breakAfter -> break
    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE');
    await service.applyAction('ADVANCE');
    await service.applyAction('ADVANCE');
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
    // ADVANCE is illegal from the lobby - the quiz has not started yet
    await expect(service.applyAction('ADVANCE')).rejects.toThrow(
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
    expect(seedService.createSession).not.toHaveBeenCalled();
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
    expect(seedService.createSession).toHaveBeenCalledWith('quiz-2');
    expect(seedService.loadGame).toHaveBeenCalledWith(
      'quiz-2',
      'session-2',
      'GHIJKL',
    );
  });

  it('selects a quiz in the lobby: creates a new session, reloads rounds, resets state', async () => {
    service.setLeaderboard([
      { teamId: 'team-1', teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    const snapshot = await service.selectQuiz('quiz-2');

    expect(seedService.createSession).toHaveBeenCalledWith('quiz-2');
    expect(seedService.loadGame).toHaveBeenCalledWith(
      'quiz-2',
      'session-2',
      'GHIJKL',
    );
    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.leaderboard).toEqual([]);
    expect(service.getActiveQuizId()).toBe('quiz-2');
    expect(service.getGameSessionId()).toBe('session-2');
  });

  it('persists later actions under the newly created session id', async () => {
    await service.selectQuiz('quiz-2');

    await service.applyAction('START_QUIZ');

    expect(progressRepository.save).toHaveBeenCalledWith('session-2', {
      status: 'question_open',
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

  it('exposes the new session join code in the snapshot after selecting a quiz', async () => {
    const snapshot = await service.selectQuiz('quiz-2');

    expect(snapshot.joinCode).toBe('GHIJKL');
  });

  describe('block questions and response indicators', () => {
    it('exposes no block questions in the lobby', () => {
      expect(service.getSnapshot().blockQuestions).toEqual([]);
    });

    it('reveals block questions cumulatively as the admin advances', async () => {
      await service.applyAction('START_QUIZ');
      expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([
        'r1q1',
      ]);

      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> r2q1 (same block: round 1 has no break)
      expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([
        'r1q1',
        'r1q2',
        'r2q1',
      ]);
    });

    it('keeps the whole locked block browsable during the grading break', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE');
      await service.applyAction('ADVANCE');
      await service.applyAction('ADVANCE');
      const snapshot = await service.applyAction('ADVANCE'); // -> break

      expect(snapshot.progress.status).toBe('break');
      expect(snapshot.blockQuestions.map((q) => q.id)).toEqual([
        'r1q1',
        'r1q2',
        'r2q1',
        'r2q2',
      ]);
    });

    it('treats every revealed block question as open for answering', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> r1q2

      expect(service.isQuestionOpenForAnswering('r1q1')).toBe(true);
      expect(service.isQuestionOpenForAnswering('r1q2')).toBe(true);
    });

    it('treats unrevealed and unknown questions as closed for answering', async () => {
      await service.applyAction('START_QUIZ');

      expect(service.isQuestionOpenForAnswering('r2q1')).toBe(false);
      expect(service.isQuestionOpenForAnswering('no-such-question')).toBe(
        false,
      );
    });

    it('closes the whole block for answering once the break starts', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE');
      await service.applyAction('ADVANCE');
      await service.applyAction('ADVANCE');
      await service.applyAction('ADVANCE'); // -> break

      expect(service.isQuestionOpenForAnswering('r1q1')).toBe(false);
      expect(service.isQuestionOpenForAnswering('r2q2')).toBe(false);
    });

    it('closes answering while still in the lobby', () => {
      expect(service.isQuestionOpenForAnswering('r1q1')).toBe(false);
    });

    it('starts with no answered team ids', () => {
      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });

    it('reflects answered team ids for the current question only', async () => {
      await service.applyAction('START_QUIZ');
      service.setAnsweredTeamIds('r1q1', ['team-1']);

      expect(service.getSnapshot().answeredTeamIds).toEqual(['team-1']);

      await service.applyAction('ADVANCE'); // -> r1q2, nobody answered it yet
      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });

    it('clears answered team ids when a new quiz session is selected', async () => {
      await service.applyAction('START_QUIZ');
      // Same question id as the imported quiz's first question, so stale
      // indicators would leak into the new session if selectQuiz kept them.
      service.setAnsweredTeamIds('iq1', ['team-1']);
      await service.applyAction('END_QUIZ');

      await service.selectQuiz('quiz-2');
      await service.applyAction('START_QUIZ'); // current question: iq1

      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });
  });
});
