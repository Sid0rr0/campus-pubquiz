import {
  QUESTION_KINDS,
  type QuestionType,
  type ScoredQuestion,
} from '@campus-pubquiz/types';
import {
  canBeUngraded,
  canGradeByHand,
  lockBatchWrites,
  gradeOnKeyFix,
  gradeOnSubmit,
  gradesAtLock,
  speedScore,
  type StoredAnswerRow,
} from '@/answer/grading-policy';

const AUTO: ScoredQuestion = {
  type: 'multiple_choice',
  answer: 'Paris',
  points: 2,
};
const MATCH_OR_HUMAN: ScoredQuestion = {
  type: 'free_text',
  answer: 'apple',
  points: 3,
};
const BATCH: ScoredQuestion = {
  type: 'closest_guess',
  answer: '1000',
  points: 5,
};

const GRADED = { value: 'x', gradedAt: new Date('2026-01-01') };
const UNGRADED = { value: 'x', gradedAt: null };

describe('Grading policy: submit', () => {
  describe('auto', () => {
    it('sets the score on a first submission', () => {
      expect(gradeOnSubmit(AUTO, 'Paris', null)).toEqual({
        kind: 'set',
        points: 2,
        verdict: 'correct',
      });
    });

    it('sets the score on a same-value resubmit even when graded (override lost)', () => {
      expect(
        gradeOnSubmit(AUTO, 'Paris', { ...GRADED, value: 'Paris' }),
      ).toEqual({ kind: 'set', points: 2, verdict: 'correct' });
    });

    it('sets the score on a changed value', () => {
      expect(gradeOnSubmit(AUTO, 'London', GRADED)).toEqual({
        kind: 'set',
        points: 0,
        verdict: 'incorrect',
      });
    });
  });

  describe('match-or-human', () => {
    it('sets correct on a first submission that matches the key', () => {
      expect(gradeOnSubmit(MATCH_OR_HUMAN, 'apple', null)).toEqual({
        kind: 'set',
        points: 3,
        verdict: 'correct',
      });
    });

    it('keeps its stored grade for a first non-matching submission (nothing stored yet)', () => {
      expect(gradeOnSubmit(MATCH_OR_HUMAN, 'pear', null)).toEqual({
        kind: 'keep',
      });
    });

    it('keeps a graded answer on a same-value resubmit, even one that matches', () => {
      expect(
        gradeOnSubmit(MATCH_OR_HUMAN, 'apple', { ...GRADED, value: 'apple' }),
      ).toEqual({ kind: 'keep' });
    });

    it('keeps an ungraded same-value non-matching answer ungraded', () => {
      expect(
        gradeOnSubmit(MATCH_OR_HUMAN, 'pear', { ...UNGRADED, value: 'pear' }),
      ).toEqual({ kind: 'keep' });
    });

    it('sets a same-value matching answer that was still ungraded', () => {
      expect(
        gradeOnSubmit(MATCH_OR_HUMAN, 'apple', {
          ...UNGRADED,
          value: 'apple',
        }),
      ).toEqual({ kind: 'set', points: 3, verdict: 'correct' });
    });

    it('clears the grade when the value changes to a non-match', () => {
      expect(gradeOnSubmit(MATCH_OR_HUMAN, 'pear', GRADED)).toEqual({
        kind: 'clear',
      });
    });

    it('sets correct when the value changes into a match', () => {
      expect(gradeOnSubmit(MATCH_OR_HUMAN, 'apple', GRADED)).toEqual({
        kind: 'set',
        points: 3,
        verdict: 'correct',
      });
    });
  });

  describe('batch', () => {
    it('keeps (never grades at submit) on a first submission', () => {
      expect(gradeOnSubmit(BATCH, '900', null)).toEqual({ kind: 'keep' });
    });

    it('clears the grade when the value changes', () => {
      expect(gradeOnSubmit(BATCH, '900', GRADED)).toEqual({ kind: 'clear' });
    });

    it('keeps on a same-value resubmit', () => {
      expect(gradeOnSubmit(BATCH, '900', { ...GRADED, value: '900' })).toEqual({
        kind: 'keep',
      });
    });
  });
});

describe('Grading policy: can grade by hand', () => {
  it('allows hand grading an auto answer, graded or not', () => {
    expect(canGradeByHand(AUTO, { gradedAt: null })).toBe(true);
    expect(canGradeByHand(AUTO, { gradedAt: new Date() })).toBe(true);
  });

  it('allows hand grading a match-or-human answer, graded or not', () => {
    expect(canGradeByHand(MATCH_OR_HUMAN, { gradedAt: null })).toBe(true);
    expect(canGradeByHand(MATCH_OR_HUMAN, { gradedAt: new Date() })).toBe(true);
  });

  it('refuses a batch answer before its batch has graded it', () => {
    expect(canGradeByHand(BATCH, { gradedAt: null })).toBe(false);
  });

  it('allows a batch answer once graded', () => {
    expect(canGradeByHand(BATCH, { gradedAt: new Date() })).toBe(true);
  });
});

describe('Grading policy: key fix', () => {
  const at = new Date('2026-01-01');
  const row = (over: Partial<StoredAnswerRow> = {}): StoredAnswerRow => ({
    value: 'x',
    responseMs: null,
    gradedAt: null,
    verdict: null,
    pointsAwarded: 0,
    ...over,
  });
  const graded = (
    value: string,
    verdict: 'correct' | 'partial',
    pointsAwarded: number,
  ) => row({ value, gradedAt: at, verdict, pointsAwarded });

  describe('auto', () => {
    it('rescores every row against the corrected key, discarding an override', () => {
      const result = gradeOnKeyFix({
        question: { ...AUTO, answer: 'Lyon' },
        previous: AUTO,
        rows: [row({ value: 'Lyon' }), graded('Paris', 'correct', 2)],
        kahootTimerSeconds: null,
        hasBatchRun: false,
      });
      expect(result).toEqual({
        rescored: true,
        writes: [
          { kind: 'set', points: 2, verdict: 'correct' },
          { kind: 'set', points: 0, verdict: 'incorrect' },
        ],
      });
    });

    it('speed-scales from the stored response time when a kahoot timer is given', () => {
      const fix = (responseMs: number) =>
        gradeOnKeyFix({
          question: AUTO,
          previous: AUTO,
          rows: [row({ value: 'Paris', responseMs })],
          kahootTimerSeconds: 10,
          hasBatchRun: false,
        }).writes[0];
      expect(fix(0)).toEqual({ kind: 'set', points: 2, verdict: 'correct' });
      expect(fix(10_000)).toMatchObject({ kind: 'set', verdict: 'correct' });
      expect((fix(10_000) as { points: number }).points).toBeLessThan(2);
    });

    it('is rescored even with no rows', () => {
      expect(
        gradeOnKeyFix({
          question: AUTO,
          previous: AUTO,
          rows: [],
          kahootTimerSeconds: null,
          hasBatchRun: false,
        }),
      ).toEqual({ rescored: true, writes: [] });
    });
  });

  describe('match-or-human', () => {
    const fix = (rows: StoredAnswerRow[]) =>
      gradeOnKeyFix({
        question: { ...MATCH_OR_HUMAN, answer: 'pear' },
        previous: MATCH_OR_HUMAN,
        rows,
        kahootTimerSeconds: null,
        hasBatchRun: false,
      });

    it('sets a row that matches the corrected key correct', () => {
      expect(fix([row({ value: 'pear' })])).toEqual({
        rescored: true,
        writes: [{ kind: 'set', points: 3, verdict: 'correct' }],
      });
    });

    it('clears a row graded automatically under the old key that no longer matches', () => {
      expect(fix([graded('apple', 'correct', 3)]).writes).toEqual([
        { kind: 'clear' },
      ]);
    });

    it('keeps a moderator grade on a non-matching row', () => {
      expect(fix([graded('apple', 'partial', 1)]).writes).toEqual([
        { kind: 'keep' },
      ]);
    });

    it('clears a moderator grade identical to the automatic one (accepted tradeoff)', () => {
      // Indistinguishable from the automatic grade, so it counts as automatic.
      expect(fix([graded('apple', 'correct', 3)]).writes).toEqual([
        { kind: 'clear' },
      ]);
    });

    it('keeps an ungraded non-matching row', () => {
      expect(fix([row({ value: 'apple' })]).writes).toEqual([{ kind: 'keep' }]);
    });
  });

  describe('batch', () => {
    const fix = (hasBatchRun: boolean) =>
      gradeOnKeyFix({
        question: BATCH,
        previous: BATCH,
        rows: [row({ value: '990' }), row({ value: '500' })],
        kahootTimerSeconds: null,
        hasBatchRun,
      });

    it('reports not rescored when the batch has not run', () => {
      expect(fix(false)).toEqual({ rescored: false, writes: [] });
    });

    it('re-runs the batch when it has already run', () => {
      expect(fix(true)).toEqual({
        rescored: true,
        writes: [
          { kind: 'set', points: 5, verdict: 'correct' },
          { kind: 'set', points: 0, verdict: 'incorrect' },
        ],
      });
    });
  });
});

describe('Grading policy: grades at the lock', () => {
  const rowOf = (value: string, gradedAt: Date | null = null) => ({
    value,
    gradedAt,
    responseMs: null,
    verdict: null,
    pointsAwarded: 0,
  });

  it('is true only for a batch question', () => {
    expect(gradesAtLock(BATCH)).toBe(true);
    expect(gradesAtLock(AUTO)).toBe(false);
    expect(gradesAtLock(MATCH_OR_HUMAN)).toBe(false);
  });

  it('batch-grades the rows when none has been graded yet', () => {
    expect(lockBatchWrites(BATCH, [rowOf('990'), rowOf('500')])).toEqual([
      { kind: 'set', points: 5, verdict: 'correct' },
      { kind: 'set', points: 0, verdict: 'incorrect' },
    ]);
  });

  it('writes nothing when any row shows the batch already ran', () => {
    expect(
      lockBatchWrites(BATCH, [rowOf('990'), rowOf('500', new Date())]),
    ).toEqual([]);
  });

  it('writes nothing when nobody answered', () => {
    expect(lockBatchWrites(BATCH, [])).toEqual([]);
  });

  it('writes nothing for the modes that do not grade at the lock', () => {
    expect(lockBatchWrites(AUTO, [rowOf('Paris')])).toEqual([]);
    expect(lockBatchWrites(MATCH_OR_HUMAN, [rowOf('apple')])).toEqual([]);
  });
});

describe('Grading policy: speed score', () => {
  const rowOf = (value: string, responseMs: number | null) => ({
    value,
    gradedAt: null,
    responseMs,
    verdict: null,
    pointsAwarded: 0,
  });

  it('scales an auto question by response time when a timer is given', () => {
    const [write] = speedScore(AUTO, [rowOf('Paris', 5000)], 10);
    expect(write).toMatchObject({ kind: 'set', verdict: 'correct' });
    if (write.kind !== 'set') throw new Error('expected a set write');
    expect(write.points).toBeGreaterThan(0);
    expect(write.points).toBeLessThan(2);
  });

  it('gives full points for an auto question without a timer', () => {
    expect(speedScore(AUTO, [rowOf('Paris', 5000)], null)).toEqual([
      { kind: 'set', points: 2, verdict: 'correct' },
    ]);
  });

  it('is idempotent', () => {
    const rows = [rowOf('Paris', 5000)];
    expect(speedScore(AUTO, rows, 10)).toEqual(speedScore(AUTO, rows, 10));
  });

  it('leaves match-or-human and batch questions untouched', () => {
    expect(speedScore(MATCH_OR_HUMAN, [rowOf('apple', 1)], 10)).toEqual([]);
    expect(speedScore(BATCH, [rowOf('1000', 1)], 10)).toEqual([]);
  });
});

describe('Grading policy: can be ungraded', () => {
  it('is false for batch and true otherwise', () => {
    expect(canBeUngraded(BATCH)).toBe(false);
    expect(canBeUngraded(AUTO)).toBe(true);
    expect(canBeUngraded(MATCH_OR_HUMAN)).toBe(true);
  });

  it.each(Object.keys(QUESTION_KINDS) as QuestionType[])(
    'agrees with the registry grading mode for %s',
    (type) => {
      const expected = QUESTION_KINDS[type].gradingMode !== 'batch';
      expect(canBeUngraded({ type })).toBe(expected);
    },
  );
});
