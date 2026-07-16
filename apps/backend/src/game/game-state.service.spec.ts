import { IllegalGameTransitionError } from '@campus-pubquiz/types';
import { GameStateService } from './game-state.service';

describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    service = new GameStateService();
  });

  it('starts in the lobby with no current question', () => {
    const snapshot = service.getSnapshot();
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('opens the first question of the first round on START_QUIZ', () => {
    const snapshot = service.applyAction('START_QUIZ');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r1q1');
  });

  it('keeps the current question visible while locked', () => {
    service.applyAction('START_QUIZ');
    const snapshot = service.applyAction('LOCK_ANSWERS');
    expect(snapshot.progress.status).toBe('locked');
    expect(snapshot.currentQuestion?.id).toBe('r1q1');
  });

  it('advances to the next question within round 1', () => {
    service.applyAction('START_QUIZ');
    service.applyAction('LOCK_ANSWERS');
    const snapshot = service.applyAction('ADVANCE');
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r1q2');
  });

  it('moves into round 2 after round 1 finishes (no break configured)', () => {
    service.applyAction('START_QUIZ');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE'); // -> r1q2
    service.applyAction('LOCK_ANSWERS');
    const snapshot = service.applyAction('ADVANCE'); // round 1 done, no break -> round 2 q0
    expect(snapshot.progress).toEqual({
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      isLeaderboardVisible: false,
    });
    expect(snapshot.currentQuestion?.id).toBe('r2q1');
  });

  it('enters a break once round 2 (breakAfter: true) finishes, hiding the question', () => {
    service.applyAction('START_QUIZ');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE'); // -> r2q1
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE'); // -> r2q2
    service.applyAction('LOCK_ANSWERS');
    const snapshot = service.applyAction('ADVANCE'); // round 2 done, breakAfter -> break
    expect(snapshot.progress.status).toBe('break');
    expect(snapshot.currentQuestion).toBeNull();
  });

  it('goes from break to reveal to ended for the final round group', () => {
    service.applyAction('START_QUIZ');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE');
    service.applyAction('LOCK_ANSWERS');
    service.applyAction('ADVANCE'); // -> break

    const revealSnapshot = service.applyAction('FINISH_GRADING');
    expect(revealSnapshot.progress.status).toBe('reveal');

    const endedSnapshot = service.applyAction('ADVANCE');
    expect(endedSnapshot.progress.status).toBe('ended');
  });

  it('toggles the leaderboard without disturbing the underlying status', () => {
    service.applyAction('START_QUIZ');
    const withLeaderboard = service.applyAction('TOGGLE_LEADERBOARD');
    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe('r1q1');
  });

  it('propagates an illegal-transition error for out-of-order actions', () => {
    expect(() => service.applyAction('LOCK_ANSWERS')).toThrow(
      IllegalGameTransitionError,
    );
  });
});
