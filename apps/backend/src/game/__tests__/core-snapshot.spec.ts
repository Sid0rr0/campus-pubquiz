import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockGameProgressRepository,
} from './test-utils';

describe('GameStateService — core snapshot', () => {
  let service: GameStateService;
  let progressRepository: MockGameProgressRepository;
  let joinCode: string;

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(progressRepository),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await expect(
      uninitialized.applyAction('ABCDEF', 'START_QUIZ'),
    ).rejects.toThrow(/before initialization/i);
  });

  it('exposes the seeded game session id', () => {
    expect(service.getGameSessionId(joinCode)).toBe(101);
  });

  it('includes the session join code in the snapshot', () => {
    expect(service.getSnapshot(joinCode).joinCode).toBe('ABCDEF');
  });

  it('summarizes the active quiz structure (blocks and topics per block) in the snapshot', () => {
    // FIXTURE_SEEDED_GAME: round-1 (no break) + round-2 (breakAfter) = 1 block of 2 topics.
    expect(service.getSnapshot(joinCode).quizStructure).toEqual({
      blockCount: 1,
      topicsPerBlock: 2,
      breakRoundNumbers: [2],
      minQuestionsPerTopic: 2,
      maxQuestionsPerTopic: 2,
    });
  });

  it('starts with no connected teams in the snapshot', () => {
    expect(service.getSnapshot(joinCode).teams).toEqual([]);
  });

  it('reflects teams set via setTeams in the snapshot', () => {
    service.setTeams(joinCode, [{ teamId: 31, teamName: 'The Quizzards' }]);

    expect(service.getSnapshot(joinCode).teams).toEqual([
      { teamId: 31, teamName: 'The Quizzards', isConnected: false },
    ]);
  });

  it('clears the connected teams when a new quiz session is selected', async () => {
    service.setTeams(joinCode, [{ teamId: 31, teamName: 'The Quizzards' }]);

    const snapshot = await service.createSession(2);

    expect(snapshot.teams).toEqual([]);
  });
});
