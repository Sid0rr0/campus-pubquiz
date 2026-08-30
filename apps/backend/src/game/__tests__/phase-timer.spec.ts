import type { GameContext, GameProgress } from '@campus-pubquiz/types';
import { computePhaseTimerFields } from '@/game/state/phase-timer.util';

const context: GameContext = {
  rounds: [
    { questionCount: 2, breakAfter: false },
    { questionCount: 2, breakAfter: true },
  ],
};

function progressAt(overrides: Partial<GameProgress>): GameProgress {
  return {
    status: 'question_open',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

describe('computePhaseTimerFields', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the very first live phase when nothing has ever been live', () => {
    const newProgress = progressAt({
      status: 'question_open',
      questionIndex: 0,
    });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      null,
      null,
      {},
    );

    expect(result).toEqual({
      livePhaseKey: 'q:0:0',
      phaseStartedAt: Date.now(),
      phaseElapsedByKey: {},
    });
  });

  it('is a no-op for a same-key sub-status change (question_open -> locking)', () => {
    const newProgress = progressAt({ status: 'locking', questionIndex: 3 });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      'q:0:3',
      1_000,
      { 'q:0:0': 5_000 },
    );

    expect(result).toEqual({
      livePhaseKey: 'q:0:3',
      phaseStartedAt: 1_000,
      phaseElapsedByKey: { 'q:0:0': 5_000 },
    });
  });

  it('keeps the frontier live and untouched when Previous shows an already-closed key', () => {
    const startedAt = Date.now();
    const newProgress = progressAt({
      status: 'question_open',
      questionIndex: 0,
    }); // already-closed q:0:0

    const result = computePhaseTimerFields(
      newProgress,
      context,
      'q:0:1', // the live frontier is q:0:1, not what's being displayed
      startedAt,
      { 'q:0:0': 5_000 },
    );

    expect(result).toEqual({
      livePhaseKey: 'q:0:1',
      phaseStartedAt: startedAt,
      phaseElapsedByKey: { 'q:0:0': 5_000 },
    });
  });

  it('keeps the frontier live and untouched through an untimed detour (e.g. round_intro)', () => {
    const startedAt = Date.now();
    const newProgress = progressAt({ status: 'round_intro' });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      'q:0:0',
      startedAt,
      {},
    );

    expect(result).toEqual({
      livePhaseKey: 'q:0:0',
      phaseStartedAt: startedAt,
      phaseElapsedByKey: {},
    });
  });

  it('closes the old frontier and opens a genuinely new question', () => {
    const startedAt = Date.now();
    jest.advanceTimersByTime(7_000);
    const newProgress = progressAt({
      status: 'question_open',
      questionIndex: 1,
    });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      'q:0:0',
      startedAt,
      {},
    );

    expect(result).toEqual({
      livePhaseKey: 'q:0:1',
      phaseStartedAt: Date.now(),
      phaseElapsedByKey: { 'q:0:0': 7_000 },
    });
  });

  it('closes the last question and opens the break the first time it starts', () => {
    const startedAt = Date.now();
    jest.advanceTimersByTime(9_000);
    const newProgress = progressAt({
      status: 'break_intro',
      roundIndex: 1,
      questionIndex: 1,
    });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      'q:0:3',
      startedAt,
      {},
    );

    expect(result).toEqual({
      livePhaseKey: 'b:0',
      phaseStartedAt: Date.now(),
      phaseElapsedByKey: { 'q:0:3': 9_000 },
    });
  });

  it('does nothing when there is no frontier yet and the new status is untimed (e.g. lobby/rules)', () => {
    const newProgress = progressAt({ status: 'rules' });

    const result = computePhaseTimerFields(
      newProgress,
      context,
      null,
      null,
      {},
    );

    expect(result).toEqual({
      livePhaseKey: null,
      phaseStartedAt: null,
      phaseElapsedByKey: {},
    });
  });
});
