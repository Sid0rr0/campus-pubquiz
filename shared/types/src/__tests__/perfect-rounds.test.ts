import { describe, expect, it } from 'vitest';
import type { Verdict } from '../answer-kind';
import { countPerfectRounds } from '../perfect-rounds';
import type { QuestionType } from '../question-types';

const q = (id: number, type: QuestionType = 'multiple_choice') => ({
  id,
  type,
});
const a = (
  questionId: number,
  teamId: number,
  verdict: Verdict | null = 'correct',
) => ({ questionId, teamId, verdict });

describe('countPerfectRounds', () => {
  const round = [{ questions: [q(1), q(2)] }];

  it('counts a team with a correct verdict on every rated question', () => {
    expect(countPerfectRounds(round, [a(1, 7), a(2, 7)])).toEqual(
      new Map([[7, 1]]),
    );
  });

  it.each([['partial' as const], ['incorrect' as const], [null]])(
    'is broken by a %s answer',
    (verdict) => {
      expect(countPerfectRounds(round, [a(1, 7), a(2, 7, verdict)])).toEqual(
        new Map(),
      );
    },
  );

  it('is broken by a missing answer', () => {
    expect(countPerfectRounds(round, [a(1, 7)])).toEqual(new Map());
  });

  it('never counts a round with no rated question', () => {
    const onlyClosest = [{ questions: [q(1, 'closest_guess')] }];
    expect(countPerfectRounds(onlyClosest, [a(1, 7)])).toEqual(new Map());
    expect(countPerfectRounds([{ questions: [] }], [a(1, 7)])).toEqual(
      new Map(),
    );
  });

  it('leaves closest guess out of a mixed round', () => {
    const mixed = [{ questions: [q(1), q(2, 'closest_guess')] }];
    expect(countPerfectRounds(mixed, [a(1, 7)])).toEqual(new Map([[7, 1]]));
  });

  it('counts per round and leaves out teams with none', () => {
    const rounds = [
      { questions: [q(1)] },
      { questions: [q(2)] },
      { questions: [q(3)] },
    ];
    const answers = [a(1, 7), a(2, 7), a(3, 7, 'partial'), a(1, 8)];
    expect(countPerfectRounds(rounds, answers)).toEqual(
      new Map([
        [7, 2],
        [8, 1],
      ]),
    );
    expect(countPerfectRounds(rounds, [a(3, 9, 'incorrect')]).has(9)).toBe(
      false,
    );
  });
});
