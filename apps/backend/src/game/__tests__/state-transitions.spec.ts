import { IllegalGameTransitionError } from '@campus-pubquiz/types';
import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
} from './test-utils';

describe('GameStateService — state transitions', () => {
  let service: GameStateService;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
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

  it('enters the locking countdown once round 2 (breakAfter: true) finishes, keeping the question visible', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    const locking = await service.applyAction('ADVANCE'); // round 2 done, breakAfter -> locking
    expect(locking.progress.status).toBe('locking');
    expect(locking.currentQuestion?.id).toBe(24);

    const breakSnapshot = await service.applyAction('ADVANCE'); // locking -> break
    expect(breakSnapshot.progress.status).toBe('break');
    expect(breakSnapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('ADVANCE'); // -> r1q2
    await service.applyAction('ADVANCE'); // -> round_intro(1)
    await service.applyAction('ADVANCE'); // -> r2q1
    await service.applyAction('ADVANCE'); // -> r2q2
    await service.applyAction('ADVANCE'); // -> locking
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

  it('propagates an illegal-transition error for out-of-order actions', async () => {
    // ADVANCE is illegal from the lobby - the quiz has not started yet
    await expect(service.applyAction('ADVANCE')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });
});
