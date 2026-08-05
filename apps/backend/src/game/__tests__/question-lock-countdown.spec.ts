import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
} from './test-utils';

describe('GameStateService — question lock countdown', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
    joinCode = service.getDefaultJoinCode();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has no lock armed in the lobby', () => {
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
  });

  it('does not arm a lock on the last question of a round with breakAfter: false', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2 (last of round 1, breakAfter: false)
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
  });

  it('does not arm a lock on the first question of a breakAfter round', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
  });

  it('does not arm a lock while merely sitting on the last question of a breakAfter round', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2 (last, breakAfter, still open)

    expect(snapshot.progress.status).toBe('question_open');
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
    expect(snapshot.questionLockAt).toBeNull();
  });

  it('arms a 60s lock deadline once the admin advances into the locking countdown', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // -> locking

    expect(locking.progress.status).toBe('locking');
    expect(service.getQuestionLockAt(joinCode)).toBe(Date.now() + 60_000);
    expect(locking.questionLockAt).toBe(Date.now() + 60_000);
  });

  it('clears the lock when the admin steps back from locking to the last question', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking, lock armed

    const back = await service.applyAction(joinCode, 'PREVIOUS'); // -> question_open again

    expect(back.progress.status).toBe('question_open');
    expect(back.questionLockAt).toBeNull();
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
  });

  it('clears the lock once the countdown advances into the break intro card', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking, lock armed
    const breakSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro

    expect(breakSnapshot.progress.status).toBe('break_intro');
    expect(breakSnapshot.questionLockAt).toBeNull();
    expect(service.getQuestionLockAt(joinCode)).toBeNull();
  });

  it('clears the lock when a new quiz is selected', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking, lock armed
    await service.applyAction(joinCode, 'END_QUIZ');

    const created = await service.createSession(2);

    expect(service.getQuestionLockAt(created.joinCode)).toBeNull();
  });

  it('re-arms a fresh lock deadline on rehydrate if restarted mid-countdown', async () => {
    const rehydratingRepository = createFakeGameProgressRepository({
      status: 'locking',
      roundIndex: 1,
      questionIndex: 1, // last question of round 2 (breakAfter: true)
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
    const rehydratedService = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(rehydratingRepository),
      createFakeOrm(),
    );
    await rehydratedService.onModuleInit();

    expect(
      rehydratedService.getQuestionLockAt(
        rehydratedService.getDefaultJoinCode(),
      ),
    ).toBe(Date.now() + 60_000);
  });
});
