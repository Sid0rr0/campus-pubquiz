import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
  type MockGameProgressRepository,
} from './test-utils';

describe('GameStateService — core snapshot', () => {
  let service: GameStateService;
  let progressRepository: MockGameProgressRepository;

  beforeEach(async () => {
    progressRepository = createFakeGameProgressRepository();
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(progressRepository),
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('throws if used before onModuleInit resolves the seeded game', async () => {
    const uninitialized = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
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
});
