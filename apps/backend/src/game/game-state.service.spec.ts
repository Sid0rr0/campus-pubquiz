import { MikroORM } from '@mikro-orm/core';
import {
  IllegalGameTransitionError,
  type GameProgress,
} from '@campus-pubquiz/types';
import type { SeedService } from '@/db/seed.service';
import type { SeededGame } from '@/db/seed.types';
import type { GameProgressRepository } from '@/game/game-progress.repository';
import { GameStateService } from '@/game/game-state.service';

// GameStateService.onModuleInit is wrapped in @CreateRequestContext(), which
// requires a real MikroORM instance (checked via `instanceof`) — these tests
// mock the DB-touching services entirely, so a prototype-only fake with a
// working em.fork() is enough to satisfy the decorator without a real DB.
function createFakeOrm(): MikroORM {
  const em = { name: 'default', fork: () => em };
  return Object.assign(Object.create(MikroORM.prototype) as MikroORM, { em });
}

const FIXTURE_SEEDED_GAME: SeededGame = {
  quizId: 1,
  gameSessionId: 101,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 11,
      title: 'General Knowledge',
      breakAfter: false,
      questions: [
        {
          id: 21,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          points: 2,
          answer: 'Paris',
        },
        {
          id: 22,
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          points: 2,
          answer: 'Jupiter',
        },
      ],
    },
    {
      id: 12,
      title: 'Landmarks & Flags',
      breakAfter: true,
      questions: [
        {
          id: 23,
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
          answer: 'Eiffel Tower',
        },
        {
          id: 24,
          type: 'free_text',
          prompt: 'Name this flag.',
          points: 3,
          answer: 'France',
        },
      ],
    },
  ],
};

const IMPORTED_QUIZ_GAME: SeededGame = {
  quizId: 2,
  gameSessionId: 102,
  joinCode: 'GHIJKL',
  rounds: [
    {
      id: 13,
      title: 'Imported Round',
      breakAfter: true,
      questions: [
        {
          id: 25,
          type: 'free_text',
          prompt: 'Imported question',
          points: 1,
          answer: 'Imported answer',
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
      .mockResolvedValue({ gameSessionId: 102, joinCode: 'GHIJKL' }),
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
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      asSeedService(createFakeSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await expect(uninitialized.applyAction('START_QUIZ')).rejects.toThrow(
      /before initialization/i,
    );
  });

  it('exposes the seeded game session id', () => {
    expect(service.getGameSessionId()).toBe(101);
  });

  it('includes the session join code in the snapshot', () => {
    expect(service.getSnapshot().joinCode).toBe('ABCDEF');
  });

  it('summarizes the active quiz structure (blocks and topics per block) in the snapshot', () => {
    // FIXTURE_SEEDED_GAME: round-1 (no break) + round-2 (breakAfter) = 1 block of 2 topics.
    expect(service.getSnapshot().quizStructure).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
    });
  });

  it('starts with no connected teams in the snapshot', () => {
    expect(service.getSnapshot().teams).toEqual([]);
  });

  it('reflects teams set via setTeams in the snapshot', () => {
    service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);

    expect(service.getSnapshot().teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('clears the connected teams when a new quiz session is selected', async () => {
    service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);

    const snapshot = await service.selectQuiz(2);

    expect(snapshot.teams).toEqual([]);
  });

  describe('team connection presence (one live device per team + kick)', () => {
    it('has no connected socket for a team that has never joined', () => {
      expect(service.getConnectedSocketId(31)).toBeUndefined();
    });

    it('tracks which socket is connected for a team', () => {
      service.setTeamConnected(31, 'socket-a');

      expect(service.getConnectedSocketId(31)).toBe('socket-a');
    });

    it('reflects isConnected in the snapshot once a team is connected', () => {
      service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);
      service.setTeamConnected(31, 'socket-a');

      expect(service.getSnapshot().teams).toEqual([
        { teamId: 31, teamName: 'The Quizzards', isConnected: true },
      ]);
    });

    it('clears a team connection by socket id and returns the freed teamId', () => {
      service.setTeams([{ teamId: 31, teamName: 'The Quizzards' }]);
      service.setTeamConnected(31, 'socket-a');

      const clearedTeamId = service.clearTeamConnectionBySocketId('socket-a');

      expect(clearedTeamId).toBe(31);
      expect(service.getConnectedSocketId(31)).toBeUndefined();
      expect(service.getSnapshot().teams).toEqual([
        { teamId: 31, teamName: 'The Quizzards', isConnected: false },
      ]);
    });

    it('returns null when clearing a socket id that is not connected to any team', () => {
      expect(
        service.clearTeamConnectionBySocketId('unknown-socket'),
      ).toBeNull();
    });

    it('does not disturb another team connection when clearing an unrelated socket id', () => {
      service.setTeamConnected(31, 'socket-a');
      service.setTeamConnected(32, 'socket-b');

      service.clearTeamConnectionBySocketId('socket-a');

      expect(service.getConnectedSocketId(31)).toBeUndefined();
      expect(service.getConnectedSocketId(32)).toBe('socket-b');
    });

    it('resets team connections when a new quiz session is selected', async () => {
      service.setTeamConnected(31, 'socket-a');

      await service.selectQuiz(2);

      expect(service.getConnectedSocketId(31)).toBeUndefined();
    });
  });

  it('starts in the lobby with no current question', () => {
    const snapshot = service.getSnapshot();
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('sends the quiz into the rules screen on START_QUIZ, without opening a question yet', async () => {
    const snapshot = await service.applyAction('START_QUIZ');
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("shows round 1's intro card when advancing past the rules screen, without opening a question yet", async () => {
    await service.applyAction('START_QUIZ');
    const snapshot = await service.applyAction('ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.roundTitle).toBe('General Knowledge');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('opens the first question of the first round when advancing past its intro card', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction('ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(21);
  });

  it('advances to the next question within round 1', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    const snapshot = await service.applyAction('ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(22);
  });

  it("shows round 2's intro card after round 1 finishes (no break configured)", async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    const snapshot = await service.applyAction('ADVANCE'); // round 1 done, no break -> round 2 intro
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.roundTitle).toBe('Landmarks & Flags');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('moves into round 2 after advancing past its intro card', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    const snapshot = await service.applyAction('ADVANCE'); // round 2 q0
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(23);
  });

  it('moves back to the previous question with PREVIOUS', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    const snapshot = await service.applyAction('PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(21);
  });

  it("moves back to round 1's intro card from its first question instead of rejecting", async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    const snapshot = await service.applyAction('PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("steps back from round 0's intro card to the rules screen", async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction('PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
    });
  });

  it('rejects moving back out of the rules screen', async () => {
    await service.applyAction('START_QUIZ');
    await expect(service.applyAction('PREVIOUS')).rejects.toThrow(
      'Cannot apply action "PREVIOUS" from state "rules"',
    );
  });

  it('enters a break once round 2 (breakAfter: true) finishes, hiding the question', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    const snapshot = await service.applyAction('ADVANCE'); // round 2 done, breakAfter -> break
    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> break

    const revealSnapshot = await service.applyAction('FINISH_GRADING');
    expect(revealSnapshot.progress.status).toBe('reveal');
    expect(revealSnapshot.progress.revealIndex).toBe(0);

    // The block has 4 questions (r1q1, r1q2, r2q1, r2q2): ADVANCE steps
    // through each one before finally leaving reveal.
    await service.applyAction('ADVANCE'); // -> revealIndex 1
    await service.applyAction('ADVANCE'); // -> revealIndex 2
    await service.applyAction('ADVANCE'); // -> revealIndex 3 (last)
    const endedSnapshot = await service.applyAction('ADVANCE'); // -> ended
    expect(endedSnapshot.progress.status).toBe('ended');
  });

  it('toggles the leaderboard without disturbing the underlying status', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    const withLeaderboard = await service.applyAction('TOGGLE_LEADERBOARD');
    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe(21);
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
      { teamId: 31, teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    expect(service.getSnapshot().leaderboard).toEqual([
      { teamId: 31, teamName: 'The Quizzards', totalPoints: 5 },
    ]);
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
      asSeedService(createFakeSeedService()),
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

  describe('block questions and response indicators', () => {
    it('exposes no block questions in the lobby', () => {
      expect(service.getSnapshot().blockQuestions).toEqual([]);
    });

    it('reveals block questions cumulatively as the admin advances', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([
        21,
      ]);

      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1) (round 1 has no break)
      await service.applyAction('ADVANCE'); // -> r2q1 (same block)
      expect(service.getSnapshot().blockQuestions.map((q) => q.id)).toEqual([
        21, 22, 23,
      ]);
    });

    it('keeps the whole locked block browsable during the grading break', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      const snapshot = await service.applyAction('ADVANCE'); // -> break

      expect(snapshot.progress.status).toBe('break');
      expect(snapshot.blockQuestions.map((q) => q.id)).toEqual([
        21, 22, 23, 24,
      ]);
    });

    it('never leaks the correct answer through blockQuestions, even during break', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      const snapshot = await service.applyAction('ADVANCE'); // -> break

      snapshot.blockQuestions.forEach((question) => {
        expect(question).not.toHaveProperty('answer');
      });
    });

    it('exposes no reveal questions outside reveal', async () => {
      await service.applyAction('START_QUIZ');
      expect(service.getSnapshot().revealQuestions).toEqual([]);

      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      const breakSnapshot = await service.applyAction('ADVANCE'); // -> break
      expect(breakSnapshot.revealQuestions).toEqual([]);
    });

    it('shows the just-finished block with correct answers once revealed', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      await service.applyAction('ADVANCE'); // -> break
      const revealed = await service.applyAction('FINISH_GRADING'); // -> reveal

      expect(revealed.progress.status).toBe('reveal');
      expect(revealed.revealQuestions.map((q) => [q.id, q.answer])).toEqual([
        [21, 'Paris'],
        [22, 'Jupiter'],
        [23, 'Eiffel Tower'],
        [24, 'France'],
      ]);
    });

    it('pages through the reveal block one question at a time via ADVANCE and PREVIOUS', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      await service.applyAction('ADVANCE'); // -> break
      const first = await service.applyAction('FINISH_GRADING'); // -> reveal
      expect(first.progress.revealIndex).toBe(0);
      expect(first.progress.status).toBe('reveal');

      const second = await service.applyAction('ADVANCE');
      expect(second.progress).toMatchObject({
        status: 'reveal',
        revealIndex: 1,
      });

      const third = await service.applyAction('ADVANCE');
      expect(third.progress).toMatchObject({
        status: 'reveal',
        revealIndex: 2,
      });

      const back = await service.applyAction('PREVIOUS');
      expect(back.progress).toMatchObject({ status: 'reveal', revealIndex: 1 });
    });

    it('rejects PREVIOUS at the very first reveal question', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      await service.applyAction('ADVANCE'); // -> break
      await service.applyAction('FINISH_GRADING'); // -> reveal, revealIndex 0

      await expect(service.applyAction('PREVIOUS')).rejects.toThrow(
        IllegalGameTransitionError,
      );
    });

    it('clears reveal questions once the admin advances past reveal', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      await service.applyAction('ADVANCE'); // -> break
      await service.applyAction('FINISH_GRADING'); // -> reveal, revealIndex 0
      await service.applyAction('ADVANCE'); // -> revealIndex 1
      await service.applyAction('ADVANCE'); // -> revealIndex 2
      await service.applyAction('ADVANCE'); // -> revealIndex 3 (last)
      const ended = await service.applyAction('ADVANCE'); // -> ended (round-2 is last)

      expect(ended.progress.status).toBe('ended');
      expect(ended.revealQuestions).toEqual([]);
    });

    it('treats every revealed block question as open for answering', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2

      expect(service.isQuestionOpenForAnswering(21)).toBe(true);
      expect(service.isQuestionOpenForAnswering(22)).toBe(true);
    });

    it('treats unrevealed and unknown questions as closed for answering', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1

      expect(service.isQuestionOpenForAnswering(23)).toBe(false);
      expect(service.isQuestionOpenForAnswering(999999)).toBe(false);
    });

    it('closes the whole block for answering once the break starts', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      await service.applyAction('ADVANCE'); // -> r1q2
      await service.applyAction('ADVANCE'); // -> round_intro(1)
      await service.applyAction('ADVANCE'); // -> r2q1
      await service.applyAction('ADVANCE'); // -> r2q2
      await service.applyAction('ADVANCE'); // -> break

      expect(service.isQuestionOpenForAnswering(21)).toBe(false);
      expect(service.isQuestionOpenForAnswering(24)).toBe(false);
    });

    it('closes answering while still in the lobby', () => {
      expect(service.isQuestionOpenForAnswering(21)).toBe(false);
    });

    it('closes answering while showing the rules screen', async () => {
      await service.applyAction('START_QUIZ');
      expect(service.isQuestionOpenForAnswering(21)).toBe(false);
    });

    it('starts with no answered team ids', () => {
      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });

    it('reflects answered team ids for the current question only', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      service.setAnsweredTeamIds(21, [31]);

      expect(service.getSnapshot().answeredTeamIds).toEqual([31]);

      await service.applyAction('ADVANCE'); // -> r1q2, nobody answered it yet
      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });

    it('clears answered team ids when a new quiz session is selected', async () => {
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // -> r1q1
      // Same question id as the imported quiz's first question, so stale
      // indicators would leak into the new session if selectQuiz kept them.
      service.setAnsweredTeamIds(25, [31]);
      await service.applyAction('END_QUIZ');

      await service.selectQuiz(2);
      await service.applyAction('START_QUIZ');
      await service.applyAction('ADVANCE'); // -> round_intro(0)
      await service.applyAction('ADVANCE'); // current question: iq1

      expect(service.getSnapshot().answeredTeamIds).toEqual([]);
    });
  });

  describe('getAdminQuestionContext', () => {
    it('returns the correct answer and round position for a question', () => {
      expect(service.getAdminQuestionContext(23)).toEqual({
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
      expect(service.getAdminQuestionContext(22)).toMatchObject({
        roundNumber: 1,
        questionNumberInRound: 2,
        totalQuestionsInRound: 2,
      });
    });

    it('returns null for an unknown question id', () => {
      expect(service.getAdminQuestionContext(999999)).toBeNull();
    });
  });
});
