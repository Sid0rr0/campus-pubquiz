import { IllegalGameTransitionError } from '@campus-pubquiz/types';
import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

describe('GameStateService — state transitions', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('starts in the lobby with no current question', () => {
    const snapshot = service.getSnapshot(joinCode);
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('sends the quiz into the rules screen on START_QUIZ, without opening a question yet', async () => {
    const snapshot = await service.applyAction(joinCode, 'START_QUIZ');
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("shows round 1's intro card when advancing past the rules screen, without opening a question yet", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    const snapshot = await service.applyAction(joinCode, 'ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(snapshot.roundTitle).toBe('General Knowledge');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('opens the first question of the first round when advancing past its intro card', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction(joinCode, 'ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
    expect(snapshot.currentQuestion?.id).toBe(21);
  });

  it('advances to the next question within round 1', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    const snapshot = await service.applyAction(joinCode, 'ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // r1q2 (block position 1) just opened
    });
    expect(snapshot.currentQuestion?.id).toBe(22);
  });

  it("shows round 2's intro card after round 1 finishes (no break configured)", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // round 1 done, no break -> round 2 intro
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // r1q2 (block position 1) was already opened
    });
    expect(snapshot.roundTitle).toBe('Landmarks & Flags');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('moves into round 2 after advancing past its intro card', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // round 2 q0
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 2, // r2q1 (block position 2) just opened
    });
    expect(snapshot.currentQuestion?.id).toBe(23);
  });

  it('moves back to the previous question with PREVIOUS', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    const snapshot = await service.applyAction(joinCode, 'PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 1, // stepping back with PREVIOUS doesn't shrink it — r1q2 stayed open
    });
    expect(snapshot.currentQuestion?.id).toBe(21);
  });

  it("moves back to round 1's intro card from its first question instead of rejecting", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    const snapshot = await service.applyAction(joinCode, 'PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'round_intro',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
    });
    expect(snapshot.currentQuestion).toBeNull();
  });

  it("steps back from round 0's intro card to the rules screen", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction(joinCode, 'PREVIOUS');
    expect(snapshot.progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
  });

  it('rejects moving back out of the rules screen', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await expect(service.applyAction(joinCode, 'PREVIOUS')).rejects.toThrow(
      'Cannot apply action "PREVIOUS" from state "rules"',
    );
  });

  it('enters the locking countdown once round 2 (breakAfter: true) finishes, keeping the question visible', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // round 2 done, breakAfter -> locking
    expect(locking.progress.status).toBe('locking');
    expect(locking.currentQuestion?.id).toBe(24);

    const breakSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // locking -> break_intro
    expect(breakSnapshot.progress.status).toBe('break_intro');
    expect(breakSnapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro

    const revealIntroSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    expect(revealIntroSnapshot.progress.status).toBe('reveal_intro');
    expect(revealIntroSnapshot.progress.revealIndex).toBe(0);

    const revealSnapshot = await service.applyAction(joinCode, 'ADVANCE');
    expect(revealSnapshot.progress.status).toBe('reveal');
    expect(revealSnapshot.progress.revealIndex).toBe(0);

    // The block has 4 questions across 2 rounds (r1q1, r1q2, r2q1, r2q2):
    // ADVANCE steps through each one, showing a fresh reveal_intro card
    // whenever it crosses into the next round, before finally leaving reveal.
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 1 (round 0, still)
    const round2Intro = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 1)
    expect(round2Intro.progress.status).toBe('reveal_intro');
    expect(round2Intro.progress.revealIndex).toBe(2);
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 2
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 3 (last)
    const endedSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> ended
    expect(endedSnapshot.progress.status).toBe('ended');
  });

  it('propagates an illegal-transition error for out-of-order actions', async () => {
    // ADVANCE is illegal from the lobby - the quiz has not started yet
    await expect(service.applyAction(joinCode, 'ADVANCE')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('round-trips through Previous and Advance around a natural end', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal (revealIndex 0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 1
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round 1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 2
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 3 (last)
    const endedSnapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> ended
    expect(endedSnapshot.progress.status).toBe('ended');
    expect(endedSnapshot.progress.previousStatus).toBe('reveal');

    const revealAgain = await service.applyAction(joinCode, 'PREVIOUS');
    expect(revealAgain.progress).toEqual({
      status: 'reveal',
      roundIndex: 1,
      questionIndex: 1,
      isLeaderboardVisible: true,
      revealIndex: 3,
      furthestOpenIndex: 3,
      previousStatus: null,
    });

    const endedAgain = await service.applyAction(joinCode, 'ADVANCE'); // -> ended again
    expect(endedAgain.progress.status).toBe('ended');
    expect(endedAgain.progress.previousStatus).toBe('reveal');
  });

  it('restores the exact live question when Previous undoes an early manual End Quiz', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    const endedSnapshot = await service.applyAction(joinCode, 'END_QUIZ');
    expect(endedSnapshot.progress.status).toBe('ended');
    expect(endedSnapshot.progress.previousStatus).toBe('question_open');

    const restored = await service.applyAction(joinCode, 'PREVIOUS');
    expect(restored.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      previousStatus: null,
    });
    expect(restored.currentQuestion?.id).toBe(21);
  });
});
